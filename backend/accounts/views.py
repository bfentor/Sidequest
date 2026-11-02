import json

from django.conf import settings
from django.http import HttpResponse
from django.utils import timezone
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import OpenApiTypes, extend_schema
from rest_framework import permissions, serializers, status
from rest_framework.response import Response
from rest_framework.views import APIView

from .services import delete_account, export_data


class PasswordSerializer(serializers.Serializer):
    password = serializers.CharField(write_only=True)

    def validate_password(self, password):
        if not self.context["request"].user.check_password(password):
            raise serializers.ValidationError(_("The password is wrong."))
        return password


class DeleteAccountView(APIView):
    """Permanently delete the signed-in user's account and everything personal in it."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=PasswordSerializer, responses={204: None})
    def post(self, request):
        PasswordSerializer(data=request.data, context={"request": request}).is_valid(
            raise_exception=True
        )
        delete_account(request.user)
        return Response(status=status.HTTP_204_NO_CONTENT)


class ExportView(APIView):
    """Everything stored about the signed-in user, as a JSON file."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(responses={(200, "application/json"): OpenApiTypes.OBJECT})
    def get(self, request):
        filename = f"sidequest-data-{timezone.now():%Y-%m-%d}.json"
        response = HttpResponse(
            json.dumps(export_data(request.user), indent=2, ensure_ascii=False),
            content_type="application/json",
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}"'
        return response


class AcceptTermsView(APIView):
    """Accept the current terms of service and privacy policy."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request):
        request.user.terms_version = settings.TERMS_VERSION
        request.user.terms_accepted_at = timezone.now()
        request.user.save(update_fields=["terms_version", "terms_accepted_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
