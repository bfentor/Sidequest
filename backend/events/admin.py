from django.contrib import admin as django_admin
from django.contrib.gis import admin

from moderation.admin import RemovableAdminMixin

from .models import Event


@admin.register(Event)
class EventAdmin(RemovableAdminMixin, admin.GISModelAdmin):
    list_display = ["title", "organizer", "starts_at", "ends_at", "removed_at"]
    list_filter = ["starts_at", ("removed_at", django_admin.EmptyFieldListFilter)]
    search_fields = ["title", "venue_name", "organizer__handle"]
    autocomplete_fields = ["organizer"]
    date_hierarchy = "starts_at"
