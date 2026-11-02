from drf_spectacular.utils import extend_schema
from rest_framework import generics, permissions, status
from rest_framework.exceptions import ValidationError
from rest_framework.response import Response
from rest_framework.throttling import ScopedRateThrottle
from rest_framework.views import APIView

from . import services
from .models import StudentStatus, University
from .serializers import (
    StudentCodeSerializer,
    StudentEmailSerializer,
    StudentStatusSerializer,
    UniversitySerializer,
)


class UniversityListView(generics.ListAPIView):
    queryset = University.objects.all()
    serializer_class = UniversitySerializer
    permission_classes = [permissions.AllowAny]
    pagination_class = None


class StudentStatusView(APIView):
    """Your student verification: see it (GET), send a code to a university
    address (POST), or remove it (DELETE)."""

    permission_classes = [permissions.IsAuthenticated]
    throttle_scope = "student_codes"

    def get_throttles(self):
        # Only sending codes is limited; it sends email.
        return [ScopedRateThrottle()] if self.request.method == "POST" else []

    @extend_schema(responses=StudentStatusSerializer)
    def get(self, request):
        status_ = StudentStatus.objects.filter(user=request.user).select_related("university")
        found = status_.first()
        return Response(StudentStatusSerializer(found).data if found else None)

    @extend_schema(request=StudentEmailSerializer, responses=UniversitySerializer)
    def post(self, request):
        serializer = StudentEmailSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            university = services.send_code(request.user, serializer.validated_data["email"])
        except services.VerificationError as error:
            raise ValidationError({"email": [str(error)]}) from error
        return Response(UniversitySerializer(university).data)

    @extend_schema(responses={204: None})
    def delete(self, request):
        StudentStatus.objects.filter(user=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class StudentVerifyView(APIView):
    """Confirm the code sent to your university address."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=StudentCodeSerializer, responses=StudentStatusSerializer)
    def post(self, request):
        serializer = StudentCodeSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        try:
            student = services.confirm_code(request.user, serializer.validated_data["code"])
        except services.VerificationError as error:
            raise ValidationError({"code": [str(error)]}) from error
        return Response(StudentStatusSerializer(student).data)
