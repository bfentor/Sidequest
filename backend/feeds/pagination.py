from rest_framework.pagination import CursorPagination, LimitOffsetPagination


class UpcomingCursorPagination(CursorPagination):
    ordering = ("starts_at", "id")
    page_size = 20


class NewestFirstCursorPagination(CursorPagination):
    ordering = ("-created_at", "-id")
    page_size = 20


class NearbyPagination(LimitOffsetPagination):
    # Cursor pagination needs a plain column to order by; distance is computed
    # per request from the caller's position, so plain offsets are used here.
    default_limit = 20
    max_limit = 50
