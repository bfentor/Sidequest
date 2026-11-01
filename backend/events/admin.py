from django.contrib.gis import admin

from .models import Event


@admin.register(Event)
class EventAdmin(admin.GISModelAdmin):
    list_display = ["title", "organizer", "starts_at", "ends_at"]
    list_filter = ["starts_at"]
    search_fields = ["title", "venue_name", "organizer__handle"]
    autocomplete_fields = ["organizer"]
    date_hierarchy = "starts_at"
