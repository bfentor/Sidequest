"""Who to follow: profiles the viewer might like, best first."""

from django.db import models
from django.db.models.functions import Cast, Ln

from config.db import count_of
from moderation.visibility import hidden_profiles, muted_profiles

from .models import Follow, FollowRequest, Profile

# Points for each signal.
PER_MUTUAL = 2.0
PER_SHARED_INTEREST = 1.0
# Times ln(1 + followers), so well-known profiles help fill the list for newcomers.
POPULARITY = 0.5


def follow_suggestions(viewer: Profile):
    """Profiles followed by people the viewer follows, sharing their interests, or popular.

    Leaves out profiles the viewer follows, asked to follow, manages, blocked
    (either way) or muted.
    """
    followed = Follow.objects.filter(follower=viewer).values("followee")
    mutuals = Follow.objects.filter(followee=models.OuterRef("pk"), follower__in=followed)
    shared_interests = Profile.interests.through.objects.filter(
        profile=models.OuterRef("pk"), category__in=viewer.interests.all()
    )
    followers = Follow.objects.filter(followee=models.OuterRef("pk"))
    score = (
        PER_MUTUAL * count_of(mutuals)
        + PER_SHARED_INTEREST * count_of(shared_interests)
        + POPULARITY * Ln(1.0 + Cast(count_of(followers), models.FloatField()))
    )
    return (
        Profile.objects.visible_to(viewer)
        .exclude(pk__in=followed)
        .exclude(pk__in=FollowRequest.objects.filter(requester=viewer).values("target"))
        .exclude(pk__in=Profile.objects.manageable_by(viewer.user).values("pk"))
        .exclude(pk__in=hidden_profiles(viewer))
        .exclude(pk__in=muted_profiles(viewer))
        .annotate(score=models.ExpressionWrapper(score, output_field=models.FloatField()))
        .order_by("-score", "-created_at")
    )
