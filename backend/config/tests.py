from config.throttling import WriteRateThrottle
from posts.models import Post


def test_writes_are_rate_limited_per_user(auth_client, make_user, monkeypatch):
    monkeypatch.setitem(WriteRateThrottle.THROTTLE_RATES, "reports", "2/hour")
    post = Post.objects.create(author=make_user().profile, body="hi")
    report = {"target_type": "post", "target_id": str(post.pk), "reason": "spam"}

    statuses = [auth_client.post("/api/reports/", report).status_code for _ in range(3)]

    assert statuses == [201, 201, 429]


def test_reads_are_not_rate_limited(auth_client, make_user, monkeypatch):
    monkeypatch.setitem(WriteRateThrottle.THROTTLE_RATES, "posts", "1/hour")
    post = Post.objects.create(author=make_user().profile, body="hi")

    statuses = {auth_client.get(f"/api/posts/{post.pk}/").status_code for _ in range(3)}

    assert statuses == {200}


def test_healthz_reports_version(api_client, db, settings):
    response = api_client.get("/healthz")
    assert response.json() == {"status": "ok", "version": settings.APP_VERSION}
