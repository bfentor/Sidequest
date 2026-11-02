from django.contrib import admin, messages
from django.urls import NoReverseMatch, reverse
from django.utils.html import format_html

from . import services
from .models import Block, ModerationAction, Mute, Report


def _target_link(obj):
    target = obj.target
    if target is None:
        return "—"
    meta = target._meta
    try:
        url = reverse(f"admin:{meta.app_label}_{meta.model_name}_change", args=[target.pk])
    except NoReverseMatch:
        return str(target)
    return format_html('<a href="{}">{}</a>', url, target)


@admin.register(Report)
class ReportAdmin(admin.ModelAdmin):
    """The moderation queue: open reports, newest first."""

    list_display = ["created_at", "content_type", "target_link", "reason", "status", "reporter"]
    list_filter = ["status", "reason", "content_type"]
    readonly_fields = [
        "reporter",
        "content_type",
        "object_id",
        "target_link",
        "reason",
        "details",
        "created_at",
        "resolved_at",
    ]
    fields = readonly_fields + ["status"]
    actions = ["remove_reported_content", "dismiss_reports"]
    ordering = ["-created_at"]

    @admin.display(description="Reported content")
    def target_link(self, obj):
        return _target_link(obj)

    def get_queryset(self, request):
        return super().get_queryset(request).select_related("content_type", "reporter")

    def has_add_permission(self, request):
        return False

    def _targets(self, queryset):
        return {report.target for report in queryset if report.target is not None}

    @admin.action(description="Remove the reported content (resolves its reports)")
    def remove_reported_content(self, request, queryset):
        targets = self._targets(queryset)
        for target in targets:
            services.remove(target, request.user, note="Removed from the report queue")
        self.message_user(request, f"Removed {len(targets)} item(s).", messages.SUCCESS)

    @admin.action(description="Dismiss: keep the content and close its reports")
    def dismiss_reports(self, request, queryset):
        targets = self._targets(queryset)
        for target in targets:
            services.dismiss(target, request.user)
        self.message_user(request, f"Dismissed reports about {len(targets)} item(s).")


@admin.register(ModerationAction)
class ModerationActionAdmin(admin.ModelAdmin):
    """Audit log of moderation, read-only."""

    list_display = ["created_at", "kind", "content_type", "target_link", "moderator", "note"]
    list_filter = ["kind", "content_type"]

    @admin.display(description="Content")
    def target_link(self, obj):
        return _target_link(obj)

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False


@admin.register(Block)
class BlockAdmin(admin.ModelAdmin):
    list_display = ["blocker", "blocked", "created_at"]
    autocomplete_fields = ["blocker", "blocked"]


@admin.register(Mute)
class MuteAdmin(admin.ModelAdmin):
    list_display = ["muter", "muted", "created_at"]
    autocomplete_fields = ["muter", "muted"]


class RemovableAdminMixin:
    """Remove/restore actions for models with `removed_at`, logged in the audit log."""

    actions = ["remove_selected", "restore_selected"]

    @admin.action(description="Remove selected (hide everywhere)")
    def remove_selected(self, request, queryset):
        for obj in queryset.filter(removed_at__isnull=True):
            services.remove(obj, request.user, note="Removed from the admin")

    @admin.action(description="Restore selected")
    def restore_selected(self, request, queryset):
        for obj in queryset.filter(removed_at__isnull=False):
            services.restore(obj, request.user, note="Restored from the admin")
