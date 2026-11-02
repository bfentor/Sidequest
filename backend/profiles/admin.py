from django.contrib import admin

from moderation.admin import RemovableAdminMixin

from .models import Follow, Invitation, Membership, Profile, VerificationRequest


class MembershipInline(admin.TabularInline):
    model = Membership
    fk_name = "organization"
    extra = 0
    autocomplete_fields = ["user"]


@admin.register(Profile)
class ProfileAdmin(RemovableAdminMixin, admin.ModelAdmin):
    list_display = ["handle", "display_name", "kind", "created_at", "removed_at"]
    list_filter = ["kind", ("removed_at", admin.EmptyFieldListFilter)]
    search_fields = ["handle", "display_name", "user__email"]
    autocomplete_fields = ["user"]
    inlines = [MembershipInline]


@admin.register(Follow)
class FollowAdmin(admin.ModelAdmin):
    list_display = ["follower", "followee", "created_at"]
    autocomplete_fields = ["follower", "followee"]


@admin.register(VerificationRequest)
class VerificationRequestAdmin(admin.ModelAdmin):
    list_display = ["organization", "status", "requested_by", "created_at"]
    list_filter = ["status"]
    readonly_fields = ["organization", "requested_by", "message", "created_at"]
    actions = ["approve", "reject"]

    @admin.action(description="Approve: give the organization the verified badge")
    def approve(self, request, queryset):
        for verification in queryset.select_related("organization"):
            verification.organization.verified = True
            verification.organization.save(update_fields=["verified"])
        queryset.update(status=VerificationRequest.Status.APPROVED)

    @admin.action(description="Reject")
    def reject(self, request, queryset):
        queryset.update(status=VerificationRequest.Status.REJECTED)


@admin.register(Invitation)
class InvitationAdmin(admin.ModelAdmin):
    list_display = ["organization", "invitee", "role", "created_at"]
    raw_id_fields = ["organization", "invitee", "invited_by"]
