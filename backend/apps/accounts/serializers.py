from django.contrib.auth.password_validation import validate_password
from rest_framework import serializers

from apps.branches.models import Branch

from .models import Role, User


class UserSerializer(serializers.ModelSerializer):
    """The session/user payload the frontend expects. The *Id fields resolve to
    related records (merchant/rider/branch) as those modules land; null for now."""

    avatarUrl = serializers.SerializerMethodField()
    branchId = serializers.SerializerMethodField()
    merchantId = serializers.SerializerMethodField()
    deliveryManId = serializers.SerializerMethodField()

    class Meta:
        model = User
        fields = [
            "id", "email", "name", "role",
            "avatarUrl", "branchId", "merchantId", "deliveryManId",
        ]

    def get_avatarUrl(self, obj):
        if not obj.avatar:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.avatar.url) if request else obj.avatar.url

    def get_branchId(self, obj):
        # Resolve the hub relevant to each role for session scoping.
        if obj.role == "branch_manager":
            return obj.branch_id
        try:
            if obj.role == "delivery_man":
                return obj.delivery_man.branch_id
            if obj.role == "merchant":
                return obj.merchant.home_branch_id
        except Exception:
            return None
        return obj.branch_id

    def get_merchantId(self, obj):
        try:
            related = getattr(obj, "merchant", None)
            return related.id if related else None
        except Exception:
            return None

    def get_deliveryManId(self, obj):
        try:
            related = getattr(obj, "delivery_man", None)
            return related.id if related else None
        except Exception:
            return None


class LoginSerializer(serializers.Serializer):
    # Accepts an email OR a phone (riders log in by phone); resolved in the view.
    email = serializers.CharField()
    password = serializers.CharField(write_only=True, trim_whitespace=False)


class ChangePasswordSerializer(serializers.Serializer):
    current_password = serializers.CharField(write_only=True, trim_whitespace=False)
    new_password = serializers.CharField(write_only=True, trim_whitespace=False)

    def validate_new_password(self, value):
        validate_password(value, self.context.get("request").user)
        return value


class AvatarSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ["avatar"]
        extra_kwargs = {"avatar": {"required": True}}


# ── Hub manager management (admin) ──────────────────────────────────────────
class ManagerSerializer(serializers.ModelSerializer):
    """A hub (branch) manager account, with its assigned hub."""

    branchId = serializers.IntegerField(source="branch_id", read_only=True)
    branchName = serializers.SerializerMethodField()
    isActive = serializers.BooleanField(source="is_active", read_only=True)

    class Meta:
        model = User
        fields = ["id", "name", "email", "branchId", "branchName", "isActive"]

    def get_branchName(self, obj):
        return obj.branch.name if obj.branch_id else None


class ManagerCreateSerializer(serializers.Serializer):
    name = serializers.CharField()
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True, min_length=6)
    branchId = serializers.PrimaryKeyRelatedField(
        source="branch", queryset=Branch.objects.all(), required=False, allow_null=True
    )

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated):
        branch = validated.pop("branch", None)
        return User.objects.create_user(
            email=validated["email"],
            password=validated["password"],
            name=validated.get("name", ""),
            role=Role.BRANCH_MANAGER,
            branch=branch,
        )


class ManagerUpdateSerializer(serializers.Serializer):
    name = serializers.CharField(required=False)
    branchId = serializers.PrimaryKeyRelatedField(
        source="branch", queryset=Branch.objects.all(), required=False, allow_null=True
    )
    isActive = serializers.BooleanField(source="is_active", required=False)

    def update(self, instance, validated):
        for key, value in validated.items():
            setattr(instance, key, value)
        instance.save()
        return instance
