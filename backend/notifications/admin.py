from django.contrib import admin

from .models import Notification, PushDevice


@admin.register(Notification)
class NotificationAdmin(admin.ModelAdmin):
    list_display = ["created_at", "kind", "recipient", "actor", "event", "read_at", "pushed_at"]
    list_filter = ["kind"]
    raw_id_fields = ["recipient", "actor", "event", "post"]


@admin.register(PushDevice)
class PushDeviceAdmin(admin.ModelAdmin):
    list_display = ["user", "created_at"]
    raw_id_fields = ["user"]
