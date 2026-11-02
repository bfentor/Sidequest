from django.contrib import admin

from moderation.admin import RemovableAdminMixin

from .models import Post


@admin.register(Post)
class PostAdmin(RemovableAdminMixin, admin.ModelAdmin):
    list_display = ["__str__", "author", "event", "created_at", "removed_at"]
    list_filter = [("removed_at", admin.EmptyFieldListFilter)]
    search_fields = ["body", "author__handle"]
    autocomplete_fields = ["author", "event"]
