from django.urls import path

from .views import AcceptTermsView, DeleteAccountView, ExportView

urlpatterns = [
    path("me/account/delete/", DeleteAccountView.as_view(), name="account-delete"),
    path("me/export/", ExportView.as_view(), name="account-export"),
    path("me/accept-terms/", AcceptTermsView.as_view(), name="accept-terms"),
]
