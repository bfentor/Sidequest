"""Organizations: creating them, their members and invitations, and verification."""

from django.db import transaction
from django.shortcuts import get_object_or_404
from django.utils.translation import gettext_lazy as _
from drf_spectacular.utils import extend_schema, extend_schema_field
from rest_framework import generics, mixins, permissions, serializers, status, viewsets
from rest_framework.decorators import action
from rest_framework.exceptions import PermissionDenied, ValidationError
from rest_framework.response import Response
from rest_framework.views import APIView

from notifications.models import Kind
from notifications.services import notify

from .models import Invitation, Membership, Profile, VerificationRequest
from .serializers import ProfileSerializer, ProfileSummarySerializer

# Serializers


class OrganizationCreateSerializer(serializers.ModelSerializer):
    class Meta:
        model = Profile
        fields = ["handle", "display_name", "bio"]

    @transaction.atomic
    def create(self, validated_data):
        organization = Profile.objects.create(kind=Profile.Kind.ORGANIZATION, **validated_data)
        Membership.objects.create(
            organization=organization, user=self.context["request"].user, role=Membership.Role.ADMIN
        )
        return organization


class ActingProfileSerializer(ProfileSummarySerializer):
    role = serializers.SerializerMethodField(
        help_text="self for your own profile, otherwise your role in the organization."
    )

    class Meta(ProfileSummarySerializer.Meta):
        fields = [*ProfileSummarySerializer.Meta.fields, "role"]
        read_only_fields = fields

    @extend_schema_field(serializers.ChoiceField(choices=["self", *Membership.Role.values]))
    def get_role(self, profile):
        return "self" if profile.user_id else profile.my_role


class MemberSerializer(serializers.ModelSerializer):
    profile = ProfileSummarySerializer(source="user.profile", read_only=True)

    class Meta:
        model = Membership
        fields = ["profile", "role", "created_at"]
        read_only_fields = ["profile", "created_at"]


class InviteSerializer(serializers.Serializer):
    handle = serializers.CharField(help_text="The person's handle.")
    role = serializers.ChoiceField(choices=Membership.Role.choices, default=Membership.Role.EDITOR)


class MemberRoleSerializer(serializers.Serializer):
    role = serializers.ChoiceField(choices=Membership.Role.choices)


class InvitationSerializer(serializers.ModelSerializer):
    organization = ProfileSummarySerializer(read_only=True)
    invitee = ProfileSummarySerializer(source="invitee.profile", read_only=True)

    class Meta:
        model = Invitation
        fields = ["id", "organization", "invitee", "role", "created_at"]
        read_only_fields = fields


class VerificationRequestSerializer(serializers.ModelSerializer):
    class Meta:
        model = VerificationRequest
        fields = ["id", "message", "status", "created_at"]
        read_only_fields = ["id", "status", "created_at"]


# Helpers


def role_in(organization, user):
    return (
        Membership.objects.filter(organization=organization, user=user)
        .values_list("role", flat=True)
        .first()
        if user.is_authenticated
        else None
    )


def require_admin(organization, user):
    if role_in(organization, user) != Membership.Role.ADMIN:
        raise PermissionDenied(_("Only the organization's admins can do this."))


# Views


class OrganizationViewSet(mixins.CreateModelMixin, viewsets.GenericViewSet):
    """Create organizations and manage them. They are shown like any profile (/api/profiles/)."""

    queryset = Profile.objects.filter(kind=Profile.Kind.ORGANIZATION, removed_at__isnull=True)
    lookup_field = "handle"
    permission_classes = [permissions.IsAuthenticated]
    serializer_class = OrganizationCreateSerializer

    def get_serializer_class(self):
        return (
            ProfileSerializer if self.action == "partial_update" else super().get_serializer_class()
        )

    def create(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        organization = serializer.save()
        return Response(
            ProfileSummarySerializer(organization, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(request=ProfileSerializer, responses=ProfileSummarySerializer)
    def partial_update(self, request, handle=None):
        """Edit the organization's profile (admins)."""
        organization = self.get_object()
        require_admin(organization, request.user)
        serializer = ProfileSerializer(
            organization, data=request.data, partial=True, context=self.get_serializer_context()
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()
        return Response(
            ProfileSummarySerializer(organization, context=self.get_serializer_context()).data
        )

    @extend_schema(methods=["GET"], responses=MemberSerializer(many=True))
    @extend_schema(methods=["POST"], request=InviteSerializer, responses=InvitationSerializer)
    @action(
        detail=True,
        methods=["get", "post"],
        permission_classes=[permissions.IsAuthenticatedOrReadOnly],
    )
    def members(self, request, handle=None):
        """List the members (GET), or invite someone by handle (POST, admins)."""
        organization = self.get_object()
        if request.method == "GET":
            members = organization.memberships.select_related("user__profile__avatar").order_by(
                "role", "created_at"
            )
            return Response(
                MemberSerializer(members, many=True, context=self.get_serializer_context()).data
            )

        require_admin(organization, request.user)
        serializer = InviteSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        invitee = Profile.objects.filter(
            handle=serializer.validated_data["handle"], kind=Profile.Kind.PERSON
        ).first()
        if invitee is None:
            raise ValidationError({"handle": _("No person has this username.")})
        if organization.memberships.filter(user=invitee.user).exists():
            raise ValidationError({"handle": _("They are already a member.")})
        invitation, created = Invitation.objects.update_or_create(
            organization=organization,
            invitee=invitee.user,
            defaults={"role": serializer.validated_data["role"], "invited_by": request.user},
        )
        if created:
            notify([invitee], Kind.ORGANIZATION_INVITE, actor=organization)
        return Response(
            InvitationSerializer(invitation, context=self.get_serializer_context()).data,
            status=status.HTTP_201_CREATED,
        )

    @extend_schema(responses=InvitationSerializer(many=True))
    @action(detail=True)
    def invitations(self, request, handle=None):
        """Invitations not answered yet (admins)."""
        organization = self.get_object()
        require_admin(organization, request.user)
        invitations = organization.invitations.select_related("invitee__profile__avatar")
        return Response(
            InvitationSerializer(invitations, many=True, context=self.get_serializer_context()).data
        )

    @extend_schema(request=VerificationRequestSerializer, responses=VerificationRequestSerializer)
    @action(detail=True, methods=["post"])
    def verification(self, request, handle=None):
        """Ask moderators for the verified badge (admins)."""
        organization = self.get_object()
        require_admin(organization, request.user)
        if organization.verified:
            raise ValidationError(_("This organization is already verified."))
        serializer = VerificationRequestSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        serializer.save(organization=organization, requested_by=request.user)
        return Response(serializer.data, status=status.HTTP_201_CREATED)


class MemberView(APIView):
    """Change a member's role (PATCH, admins), or remove them (DELETE, admins).

    Members can also DELETE themselves to leave.
    """

    permission_classes = [permissions.IsAuthenticated]

    def _membership(self, handle, member):
        return get_object_or_404(
            Membership.objects.select_related("user__profile"),
            organization__handle=handle,
            organization__kind=Profile.Kind.ORGANIZATION,
            user__profile__handle=member,
        )

    def _keep_an_admin(self, membership):
        others = membership.organization.memberships.exclude(pk=membership.pk)
        if (
            membership.role == Membership.Role.ADMIN
            and not others.filter(role=Membership.Role.ADMIN).exists()
        ):
            raise ValidationError(_("An organization needs at least one admin."))

    @extend_schema(request=MemberRoleSerializer, responses=MemberSerializer)
    def patch(self, request, handle, member):
        membership = self._membership(handle, member)
        require_admin(membership.organization, request.user)
        serializer = MemberRoleSerializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        role = serializer.validated_data["role"]
        if role != Membership.Role.ADMIN:
            self._keep_an_admin(membership)
        membership.role = role
        membership.save(update_fields=["role"])
        return Response(MemberSerializer(membership).data)

    @extend_schema(responses={204: None})
    def delete(self, request, handle, member):
        membership = self._membership(handle, member)
        if membership.user != request.user:
            require_admin(membership.organization, request.user)
        self._keep_an_admin(membership)
        membership.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)


class ActingProfilesView(generics.ListAPIView):
    """Profiles the signed-in user can publish as: their own, then their organizations."""

    serializer_class = ActingProfileSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def list(self, request, *args, **kwargs):
        own = request.user.profile
        organizations = list(
            Profile.objects.filter(memberships__user=request.user, removed_at__isnull=True)
            .select_related("avatar")
            .order_by("display_name")
        )
        roles = dict(request.user.memberships.values_list("organization_id", "role"))
        for organization in organizations:
            organization.my_role = roles[organization.pk]
        data = self.get_serializer([own, *organizations], many=True).data
        return Response(data)


class MyInvitationsView(generics.ListAPIView):
    """Invitations to organizations waiting for the signed-in user's answer."""

    serializer_class = InvitationSerializer
    permission_classes = [permissions.IsAuthenticated]
    pagination_class = None

    def get_queryset(self):
        return self.request.user.invitations.select_related(
            "organization__avatar", "invitee__profile"
        )


class MyInvitationView(APIView):
    """Accept (POST) or decline (DELETE) an invitation."""

    permission_classes = [permissions.IsAuthenticated]

    @extend_schema(request=None, responses={204: None})
    def post(self, request, pk):
        invitation = get_object_or_404(Invitation, pk=pk, invitee=request.user)
        with transaction.atomic():
            Membership.objects.get_or_create(
                organization=invitation.organization,
                user=request.user,
                defaults={"role": invitation.role},
            )
            invitation.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

    @extend_schema(request=None, responses={204: None})
    def delete(self, request, pk):
        get_object_or_404(Invitation, pk=pk, invitee=request.user).delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
