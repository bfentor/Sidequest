import re

from django.contrib.postgres.search import SearchQuery, SearchRank, SearchVector, TrigramSimilarity
from django.db.models import F, Q
from django.db.models.functions import Upper
from django.utils import timezone
from drf_spectacular.utils import OpenApiParameter, extend_schema
from rest_framework import permissions, serializers
from rest_framework.response import Response
from rest_framework.views import APIView

from events.models import Event
from events.serializers import EventSerializer
from moderation.visibility import viewer_profile
from profiles.models import Profile
from profiles.serializers import ProfileSummarySerializer

RESULTS = 20
# How alike (0–1) a misspelled title or name must be to count as a match.
MIN_SIMILARITY = 0.3


class SearchResultsSerializer(serializers.Serializer):
    events = EventSerializer(many=True)
    profiles = ProfileSummarySerializer(many=True)


def prefix_query(text):
    """Every word as a prefix ("boar gam" finds "Board game night").

    Only word characters reach the query, so user input can't inject tsquery syntax.
    """
    words = re.findall(r"\w+", text)
    if not words:
        return None
    return SearchQuery(
        " & ".join(f"{word}:*" for word in words), config="simple", search_type="raw"
    )


def search_events(text, viewer, include_past):
    query = prefix_query(text)
    if query is None:
        return Event.objects.none()
    # "simple" (no stemming), since titles are in Finnish, Swedish and English.
    vector = SearchVector("title", weight="A", config="simple") + SearchVector(
        "description", "venue_name", weight="B", config="simple"
    )
    events = Event.objects.in_feeds_of(viewer)
    if not include_past:
        events = events.filter(ends_at__gte=timezone.now())
    return (
        events.annotate(
            document=vector,
            rank=SearchRank(vector, query),
            similarity=TrigramSimilarity(Upper("title"), text.upper()),
        )
        # A real full-text match (ts_rank is never quite 0, so the rank can't tell).
        .filter(Q(document=query) | Q(similarity__gt=MIN_SIMILARITY))
        .order_by(-(F("rank") + F("similarity")), "starts_at")
        .for_display(viewer)[:RESULTS]
    )


def search_profiles(text, viewer):
    handle = text.lstrip("@").lower()
    return (
        Profile.objects.visible_to(viewer)
        .annotate(
            similarity=TrigramSimilarity(Upper("display_name"), text.upper())
            + TrigramSimilarity("handle", handle)
        )
        .filter(
            Q(display_name__icontains=text)
            | Q(handle__icontains=handle)
            | Q(similarity__gt=MIN_SIMILARITY)
        )
        .order_by("-verified", "-similarity", "handle")
        .select_related("avatar")[:RESULTS]
    )


class SearchView(APIView):
    """Events and profiles matching a search, best matches first."""

    permission_classes = [permissions.AllowAny]

    @extend_schema(
        parameters=[
            OpenApiParameter("q", str, required=True, description="What to look for."),
            OpenApiParameter(
                "include_past", bool, default=False, description="Also events that have ended."
            ),
        ],
        responses=SearchResultsSerializer,
    )
    def get(self, request):
        text = request.query_params.get("q", "").strip()[:100]
        if len(text) < 2:
            return Response({"events": [], "profiles": []})
        viewer = viewer_profile(request)
        include_past = request.query_params.get("include_past") in ("1", "true")
        context = {"request": request}
        return Response(
            {
                "events": EventSerializer(
                    search_events(text, viewer, include_past), many=True, context=context
                ).data,
                "profiles": ProfileSummarySerializer(
                    search_profiles(text, viewer), many=True, context=context
                ).data,
            }
        )
