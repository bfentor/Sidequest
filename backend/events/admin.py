from django.contrib import admin as django_admin
from django.contrib.gis import admin

from moderation.admin import RemovableAdminMixin

from .models import Category, Event


@admin.register(Event)
class EventAdmin(RemovableAdminMixin, admin.GISModelAdmin):
    list_display = ["title", "organizer", "starts_at", "ends_at", "removed_at"]
    list_filter = ["starts_at", ("removed_at", django_admin.EmptyFieldListFilter)]
    search_fields = ["title", "venue_name", "organizer__handle"]
    autocomplete_fields = ["organizer"]
    date_hierarchy = "starts_at"
    filter_horizontal = ["categories"]


@admin.register(Category)
class CategoryAdmin(django_admin.ModelAdmin):
    list_display = ["name_en", "name_fi", "name_sv", "slug", "icon", "position"]
    list_editable = ["position"]
    prepopulated_fields = {"slug": ["name_en"]}
