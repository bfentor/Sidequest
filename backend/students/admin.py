from django.contrib import admin

from .models import StudentStatus, University


@admin.register(University)
class UniversityAdmin(admin.ModelAdmin):
    list_display = ["name", "short_name", "email_domains"]
    search_fields = ["name", "short_name", "email_domains"]


@admin.register(StudentStatus)
class StudentStatusAdmin(admin.ModelAdmin):
    list_display = ["user", "university", "email", "verified_at"]
    list_filter = ["university"]
    raw_id_fields = ["user"]
