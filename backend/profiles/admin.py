from django.contrib import admin

from moderation.admin import RemovableAdminMixin

from .models import Follow, Membership, Profile


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
