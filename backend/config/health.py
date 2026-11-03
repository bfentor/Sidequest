from django.conf import settings
from django.db import connection
from django.http import JsonResponse


def healthz(request):
    """Liveness check for the deploy: answers once the database is reachable."""
    connection.ensure_connection()
    return JsonResponse(
        {"status": "ok", "version": settings.APP_VERSION, "commit": settings.APP_COMMIT}
    )
