import re
from datetime import timedelta

import pytest
from django.core import mail
from django.utils import timezone

from students.models import StudentStatus, University, VerificationCode


@pytest.fixture(autouse=True)
def outbox(settings):
    settings.MAILERS = {"default": {"BACKEND": "django.core.mail.backends.locmem.EmailBackend"}}


def emailed_code():
    return re.search(r"\b(\d{6})\b", mail.outbox[-1].body).group(1)


@pytest.mark.django_db
def test_domains_match_subdomains():
    lut = University.objects.get(short_name="LUT")
    assert University.for_email("someone@student.lut.fi") == lut
    assert University.for_email("someone@lut.fi") == lut
    assert University.for_email("someone@notlut.fi") is None
    assert University.for_email("someone@gmail.com") is None


def test_verify_with_the_emailed_code(auth_client):
    response = auth_client.post("/api/me/student/", {"email": "me@student.lut.fi"})
    assert response.json()["short_name"] == "LUT"
    assert mail.outbox[-1].to == ["me@student.lut.fi"]

    assert auth_client.post("/api/me/student/verify/", {"code": "000000"}).status_code == 400
    verified = auth_client.post("/api/me/student/verify/", {"code": emailed_code()})

    assert verified.status_code == 200
    assert verified.json()["university"]["short_name"] == "LUT"
    profile = auth_client.get("/api/me/").json()
    assert profile["student_of"]["short_name"] == "LUT"


def test_rejects_non_university_addresses(auth_client):
    assert auth_client.post("/api/me/student/", {"email": "me@gmail.com"}).status_code == 400


def test_codes_expire_and_limit_attempts(auth_client):
    auth_client.post("/api/me/student/", {"email": "me@aalto.fi"})
    code = emailed_code()
    wrong = "111111" if code != "111111" else "222222"
    for _ in range(5):
        auth_client.post("/api/me/student/verify/", {"code": wrong})
    assert auth_client.post("/api/me/student/verify/", {"code": code}).status_code == 400

    auth_client.post("/api/me/student/", {"email": "me@aalto.fi"})
    VerificationCode.objects.update(expires_at=timezone.now() - timedelta(minutes=1))
    assert auth_client.post("/api/me/student/verify/", {"code": emailed_code()}).status_code == 400


def test_old_verification_expires(auth_client, user):
    lut = University.objects.get(short_name="LUT")
    StudentStatus.objects.create(
        user=user,
        university=lut,
        email="x@lut.fi",
        verified_at=timezone.now() - timedelta(days=500),
    )
    assert auth_client.get("/api/me/").json()["student_of"] is None


def test_students_only_events(auth_client, user, make_user, make_event):
    lut = University.objects.get(short_name="LUT")
    event = make_event(make_user().profile, students_of=lut)
    url = f"/api/events/{event.pk}/attendance/"

    assert auth_client.put(url, {"status": "going"}, format="json").status_code == 400
    StudentStatus.objects.create(
        user=user, university=lut, email="x@lut.fi", verified_at=timezone.now()
    )
    assert auth_client.put(url, {"status": "going"}, format="json").status_code == 200


def test_university_signup_address_counts(api_client, db):
    signup = api_client.post(
        "/_allauth/app/v1/auth/signup",
        {
            "email": "new@student.lut.fi",
            "password": "a-long-passphrase",
            "birth_date": "2000-01-01",
            "accept_terms": True,
        },
        format="json",
    )
    code = re.search(r"^([A-Z0-9]{4}-[A-Z0-9]{4})$", mail.outbox[-1].body, re.M).group(1)
    api_client.post(
        "/_allauth/app/v1/auth/email/verify",
        {"key": code},
        format="json",
        headers={"X-Session-Token": signup.json()["meta"]["session_token"]},
    )

    assert StudentStatus.objects.get().university.short_name == "LUT"
