from django.db import transaction

from profiles.models import Membership, Profile


def _hand_over_organizations(user):
    """Before someone leaves: no organization should be left without an admin.

    Their longest-standing fellow member becomes admin; an organization with no
    other members is deleted with them.
    """
    for membership in user.memberships.filter(role=Membership.Role.ADMIN).select_related(
        "organization"
    ):
        organization = membership.organization
        others = organization.memberships.exclude(user=user)
        if others.filter(role=Membership.Role.ADMIN).exists():
            continue
        successor = others.order_by("created_at").first()
        if successor is None:
            organization.delete()
        else:
            successor.role = Membership.Role.ADMIN
            successor.save(update_fields=["role"])


@transaction.atomic
def delete_account(user):
    """Delete a user and everything personal: their profile, posts, events, RSVPs, follows.

    Pictures they uploaded lose their owner and are removed by delete_orphan_images
    unless an organization still uses them.
    """
    _hand_over_organizations(user)
    Profile.objects.filter(user=user).delete()
    user.delete()


def export_data(user):
    """Everything stored about a user, for the GDPR right of access."""
    profile = user.profile
    return {
        "account": {
            "email": user.email,
            "joined": user.date_joined.isoformat(),
            "last_login": user.last_login.isoformat() if user.last_login else None,
            "language": user.language,
        },
        "profile": {
            "handle": profile.handle,
            "display_name": profile.display_name,
            "bio": profile.bio,
            "pronouns": profile.pronouns,
            "university": profile.university,
            "faculty": profile.faculty,
            "study_year": profile.study_year,
            "website": profile.website,
            "instagram": profile.instagram,
            "is_private": profile.is_private,
            "hide_followers": profile.hide_followers,
            "hide_attendance": profile.hide_attendance,
            "avatar": profile.avatar.file.url if profile.avatar else None,
            "cover": profile.cover.file.url if profile.cover else None,
            "interests": list(profile.interests.values_list("slug", flat=True)),
        },
        "following": list(profile.follows.values_list("followee__handle", flat=True)),
        "followers": list(profile.followed_by.values_list("follower__handle", flat=True)),
        "blocked": list(profile.blocks.values_list("blocked__handle", flat=True)),
        "muted": list(profile.mutes.values_list("muted__handle", flat=True)),
        "organizations": [
            {"handle": handle, "role": role}
            for handle, role in user.memberships.values_list("organization__handle", "role")
        ],
        "posts": [
            {"created_at": created.isoformat(), "body": body, "event": event}
            for created, body, event in profile.posts.values_list("created_at", "body", "event_id")
        ],
        "events": [
            {
                "title": event.title,
                "description": event.description,
                "starts_at": event.starts_at.isoformat(),
                "ends_at": event.ends_at.isoformat(),
                "venue_name": event.venue_name,
                "address": event.address,
            }
            for event in profile.events.all()
        ],
        "rsvps": [
            {"event": title, "status": status}
            for title, status in profile.attendances.values_list("event__title", "status")
        ],
        "reports_made": [
            {"created_at": created.isoformat(), "reason": reason, "details": details}
            for created, reason, details in user.reports.values_list(
                "created_at", "reason", "details"
            )
        ],
        "notifications": [
            {"created_at": created.isoformat(), "kind": kind}
            for created, kind in user.notifications.values_list("created_at", "kind")
        ],
        "push_devices": user.push_devices.count(),
    }
