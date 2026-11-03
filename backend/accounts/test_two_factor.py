"""Two-factor sign-in and sessions, as the app uses them (allauth headless, "app" client)."""

import base64
import hashlib
import hmac
import struct
import time

import pytest
from allauth.account.models import EmailAddress

from accounts.models import User

BASE = "/_allauth/app/v1"
PASSWORD = "a-long-passphrase"


def totp(secret):
    """The current code an authenticator app would show (RFC 6238).

    Codes last 30 seconds and the server allows no leeway, so near the end of
    a period this waits for the next one: the code mustn't expire before the
    server checks it.
    """
    remaining = 30 - time.time() % 30
    if remaining < 3:
        time.sleep(remaining + 0.1)
    key = base64.b32decode(secret + "=" * (-len(secret) % 8))
    digest = hmac.new(key, struct.pack(">Q", int(time.time()) // 30), hashlib.sha1).digest()
    offset = digest[-1] & 15
    number = struct.unpack(">I", digest[offset : offset + 4])[0] & 0x7FFFFFFF
    return f"{number % 10**6:06d}"


@pytest.fixture
def signed_in(api_client, db):
    user = User.objects.create_user(email="m@uni.example", password=PASSWORD)
    EmailAddress.objects.create(user=user, email=user.email, verified=True, primary=True)
    login = api_client.post(
        f"{BASE}/auth/login", {"email": user.email, "password": PASSWORD}, format="json"
    )
    return {"X-Session-Token": login.json()["meta"]["session_token"]}


def enable_totp(api_client, headers):
    secret = api_client.get(f"{BASE}/account/authenticators/totp", headers=headers).json()["meta"][
        "secret"
    ]
    api_client.post(
        f"{BASE}/auth/reauthenticate", {"password": PASSWORD}, format="json", headers=headers
    )
    response = api_client.post(
        f"{BASE}/account/authenticators/totp",
        {"code": totp(secret)},
        format="json",
        headers=headers,
    )
    assert response.status_code == 200
    return secret


def test_enabling_two_factor_requires_the_password(api_client, signed_in):
    secret = api_client.get(f"{BASE}/account/authenticators/totp", headers=signed_in).json()[
        "meta"
    ]["secret"]
    response = api_client.post(
        f"{BASE}/account/authenticators/totp",
        {"code": totp(secret)},
        format="json",
        headers=signed_in,
    )
    # Turning on two-factor needs the password confirmed first.
    assert response.status_code == 401
    assert [f["id"] for f in response.json()["data"]["flows"]][0] == "reauthenticate"


def test_sign_in_with_two_factor_and_recovery_codes(api_client, signed_in):
    secret = enable_totp(api_client, signed_in)
    codes = api_client.get(
        f"{BASE}/account/authenticators/recovery-codes", headers=signed_in
    ).json()["data"]["unused_codes"]
    assert len(codes) == 10

    for use_recovery_code in (False, True):
        login = api_client.post(
            f"{BASE}/auth/login", {"email": "m@uni.example", "password": PASSWORD}, format="json"
        ).json()
        assert any(
            f["id"] == "mfa_authenticate" and f.get("is_pending") for f in login["data"]["flows"]
        )
        # Made only now: checking the password above is slow on purpose.
        code = codes[0] if use_recovery_code else totp(secret)
        done = api_client.post(
            f"{BASE}/auth/2fa/authenticate",
            {"code": code},
            format="json",
            headers={"X-Session-Token": login["meta"]["session_token"]},
        )
        assert done.status_code == 200


def test_sessions_list(api_client, signed_in):
    sessions = api_client.get(f"{BASE}/auth/sessions", headers=signed_in).json()["data"]
    assert [s["is_current"] for s in sessions] == [True]
