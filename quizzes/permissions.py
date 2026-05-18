from rest_framework.permissions import BasePermission, SAFE_METHODS


class IsQuizAccessible(BasePermission):
    def has_object_permission(self, request, view, obj):
        return obj.is_accessible_for(request.user)


class IsAuthorOrReadOnly(BasePermission):
    def has_object_permission(self, request, view, obj):
        if request.method in SAFE_METHODS:
            return True
        return obj.author == request.user

class IsTeacherOrReadOnly(BasePermission):
    """
    Разрешаем всем читать (GET/HEAD/OPTIONS),
    а менять/создавать — только Teachers или суперпользователю.
    """
    def has_permission(self, request, view):
        if request.method in SAFE_METHODS:
            return True

        user = request.user
        if not user or not user.is_authenticated:
            return False

        return user.is_superuser or user.groups.filter(name="Teachers").exists()
