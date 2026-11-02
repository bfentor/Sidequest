"""The code-based email flows the app uses (django-allauth headless, "app" client)."""

import re

import pytest
from django.core import mail

from accounts.models import User

BASE = "/_allauth/app/v1"
SIGNUP = {
    "email": "new@uni.example",
    "password": "a-long-passphrase",
    "birth_date": "2000-01-01",
    "accept_terms": True,
}


@pytest.fixture(autouse=True)
def outbox(settings):
    settings.MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}


def last_code():
    """The code in the newest email, e.g. "PZPD-KVMN"."""
    return re.search(r"^([A-Z0-9]{4}-[A-Z0-9]{4})$", mail.outbox[-1].body, re.M).group(1)


def post(client, path, data, token=None):
    headers = {"X-Session-Token": token} if token else {}
    return client.post(f"{BASE}{path}", data, format="json", headers=headers)


def sign_up_and_verify(client):
    pending = post(client, "/auth/signup", SIGNUP).json()
    assert [f["id"] for f in pending["data"]["flows"] if f.get("is_pending")] == ["verify_email"]
    verified = post(
        client, "/auth/email/verify", {"key": last_code()}, pending["meta"]["session_token"]
    )
    assert verified.status_code == 200
    return verified.json()["meta"]["session_token"]


def test_signup_needs_the_emailed_code(api_client, db):
    pending = post(api_client, "/auth/signup", SIGNUP).json()
    token = pending["meta"]["session_token"]
    assert mail.outbox[-1].subject.startswith("[Sidequest]")

    assert post(api_client, "/auth/email/verify", {"key": "AAAA-BBBB"}, token).status_code == 400
    verified = post(api_client, "/auth/email/verify", {"key": last_code()}, token)

    assert verified.status_code == 200 and verified.json()["meta"]["is_authenticated"]


def test_change_email_after_verifying_the_new_address(api_client, db):
    token = sign_up_and_verify(api_client)

    post(api_client, "/account/email", {"email": "moved@uni.example"}, token)
    assert mail.outbox[-1].to == ["moved@uni.example"]
    assert post(api_client, "/auth/email/verify", {"key": last_code()}, token).status_code == 200

    assert User.objects.get().email == "moved@uni.example"


def test_password_reset_by_code_signs_in(api_client, db):
    sign_up_and_verify(api_client)

    request = post(api_client, "/auth/password/request", {"email": SIGNUP["email"]})
    reset = post(
        api_client,
        "/auth/password/reset",
        {"key": last_code(), "password": "another-long-passphrase"},
        request.json()["meta"]["session_token"],
    )

    assert reset.status_code == 200 and reset.json()["meta"]["session_token"]
    assert User.objects.get().check_password("another-long-passphrase")


def test_change_password(api_client, db):
    token = sign_up_and_verify(api_client)
    response = post(
        api_client,
        "/account/password/change",
        {"current_password": SIGNUP["password"], "new_password": "brand-new-passphrase"},
        token,
    )
    assert response.status_code == 200
