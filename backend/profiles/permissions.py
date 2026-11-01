from rest_framework import permissions

from .models import Profile


class CanActAsOwner(permissions.BasePermission):
    """Write access only for users who may act as the object's owning profile.

    The view declares which attribute holds that profile via `owner_field`.
    """

    def has_object_permission(self, request, view, obj):
        if request.method in permissions.SAFE_METHODS:
            return True
        owner = getattr(obj, view.owner_field)
        return Profile.objects.manageable_by(request.user).filter(pk=owner.pk).exists()
