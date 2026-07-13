from rest_framework.permissions import BasePermission

# Role constants (kept in sync with apps.accounts.models.Role).
ADMIN = "admin"
SUPER_ADMIN = "super_admin"
BRANCH_MANAGER = "branch_manager"
MERCHANT = "merchant"
DELIVERY_MAN = "delivery_man"


class _RolePermission(BasePermission):
    roles: tuple = ()

    def has_permission(self, request, view):
        user = request.user
        return bool(user and user.is_authenticated and user.role in self.roles)


class IsAdmin(_RolePermission):
    roles = (ADMIN, SUPER_ADMIN)


class IsSuperAdmin(_RolePermission):
    roles = (SUPER_ADMIN,)


class IsBranchManager(_RolePermission):
    roles = (BRANCH_MANAGER,)


class IsMerchant(_RolePermission):
    roles = (MERCHANT,)


class IsRider(_RolePermission):
    roles = (DELIVERY_MAN,)


class IsAdminOrBranchManager(_RolePermission):
    roles = (ADMIN, SUPER_ADMIN, BRANCH_MANAGER)


class IsMerchantOrAdmin(_RolePermission):
    roles = (ADMIN, SUPER_ADMIN, MERCHANT)
