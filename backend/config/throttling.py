from rest_framework.permissions import SAFE_METHODS
from rest_framework.throttling import ScopedRateThrottle


class WriteRateThrottle(ScopedRateThrottle):
    """Limits how often a user can write (post, follow, report…) per view `throttle_scope`.

    Reads aren't limited, and views without a scope aren't either.
    """

    def allow_request(self, request, view):
        if request.method in SAFE_METHODS:
            return True
        return super().allow_request(request, view)
