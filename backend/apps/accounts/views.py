from django.contrib.auth import authenticate
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response
from rest_framework_simplejwt.serializers import TokenRefreshSerializer
from rest_framework_simplejwt.tokens import RefreshToken

from apps.common.views import BaseAPIView

from .models import User
from .serializers import (
    AvatarSerializer,
    ChangePasswordSerializer,
    LoginSerializer,
    ManagerCreateSerializer,
    ManagerSerializer,
    ManagerUpdateSerializer,
    UserSerializer,
)


def _require_admin(user):
    if user.role not in ("admin", "super_admin"):
        raise PermissionDenied("Only admins can manage hub managers.")


def tokens_for(user):
    refresh = RefreshToken.for_user(user)
    return {"access": str(refresh.access_token), "refresh": str(refresh)}


def resolve_login_email(identifier: str):
    """Map a login identifier to an account email. Supports phone login (riders,
    merchants) in addition to email — returns None if nothing matches."""
    identifier = identifier.strip()
    if "@" in identifier:
        return identifier.lower()
    user = (
        User.objects.filter(delivery_man__phone=identifier).first()
        or User.objects.filter(merchant__phone=identifier).first()
    )
    return user.email if user else None


class LoginView(BaseAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = LoginSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        email = resolve_login_email(ser.validated_data["email"])
        user = (
            authenticate(request, username=email, password=ser.validated_data["password"])
            if email
            else None
        )
        if user is None:
            return Response({"detail": "Invalid email or password.", "errors": {}}, status=401)

        data = tokens_for(user)
        data["user"] = UserSerializer(user, context={"request": request}).data
        return Response(data)


class RefreshView(BaseAPIView):
    permission_classes = [AllowAny]

    def post(self, request):
        ser = TokenRefreshSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        return Response(ser.validated_data)


class MeView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(UserSerializer(request.user, context={"request": request}).data)


class ChangePasswordView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = ChangePasswordSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        user = request.user
        if not user.check_password(ser.validated_data["current_password"]):
            return Response(
                {"detail": "Current password is incorrect.", "errors": {}}, status=400
            )
        user.set_password(ser.validated_data["new_password"])
        user.save(update_fields=["password"])
        return Response({"detail": "Password changed."})


class AvatarView(BaseAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser]

    def put(self, request):
        ser = AvatarSerializer(request.user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(UserSerializer(request.user, context={"request": request}).data)


class ManagerListCreateView(BaseAPIView):
    """Admin: list hub managers, or create a new one (optionally assigned)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        _require_admin(request.user)
        qs = (
            User.objects.filter(role="branch_manager")
            .select_related("branch")
            .order_by("name")
        )
        page = self.paginate(qs, request)
        data = ManagerSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        _require_admin(request.user)
        ser = ManagerCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        user = ser.save()
        return Response(ManagerSerializer(user).data, status=201)


class ManagerDetailView(BaseAPIView):
    """Admin: reassign a manager's hub, rename, or (de)activate."""

    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        _require_admin(request.user)
        user = User.objects.filter(pk=pk, role="branch_manager").first()
        if user is None:
            raise NotFound("Manager not found.")
        ser = ManagerUpdateSerializer(user, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ManagerSerializer(user).data)
