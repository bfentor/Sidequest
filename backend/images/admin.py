from django.contrib import admin

from .models import Image


@admin.register(Image)
class ImageAdmin(admin.ModelAdmin):
    list_display = ["__str__", "uploader", "width", "height", "created_at"]
    search_fields = ["file", "uploader__email"]
    readonly_fields = ["width", "height"]
