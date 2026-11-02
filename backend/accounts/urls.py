from django.urls import path

from .views import DeleteAccountView, ExportView

urlpatterns = [
    path("me/account/delete/", DeleteAccountView.as_view(), name="account-delete"),
    path("me/export/", ExportView.as_view(), name="account-export"),
]
