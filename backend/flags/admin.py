from django.contrib import admin

from .models import Flag


@admin.register(Flag)
class FlagAdmin(admin.ModelAdmin):
    list_display = ["name", "everyone", "staff", "percent", "description"]
    list_editable = ["everyone", "staff", "percent"]
    search_fields = ["name", "description"]
    filter_horizontal = ["testers"]
