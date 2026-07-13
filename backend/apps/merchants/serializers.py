from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.branches.models import Branch

from .models import Merchant, MerchantApiKey, MerchantWebhook, WebhookDelivery


class MerchantSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    shopName = serializers.CharField(source="shop_name", read_only=True)
    businessType = serializers.CharField(source="business_type", read_only=True)
    joinDate = serializers.DateField(source="join_date", read_only=True)
    codCollected = serializers.IntegerField(source="cod_collected", read_only=True)
    codDisbursed = serializers.IntegerField(source="cod_disbursed", read_only=True)
    codPending = serializers.IntegerField(source="cod_pending", read_only=True)
    homeBranchId = serializers.IntegerField(source="home_branch_id", read_only=True)
    code = serializers.SerializerMethodField()

    class Meta:
        model = Merchant
        fields = [
            "id", "name", "shopName", "phone", "email", "address", "district",
            "businessType", "status", "joinDate",
            "codCollected", "codDisbursed", "codPending", "homeBranchId", "code",
        ]

    def get_code(self, obj):
        return f"MCH-{obj.id:04d}"


class MerchantCreateSerializer(serializers.ModelSerializer):
    """Admin creates a merchant + its linked login user."""

    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True)
    shopName = serializers.CharField(source="shop_name")
    businessType = serializers.CharField(source="business_type", required=False, allow_blank=True)
    homeBranchId = serializers.PrimaryKeyRelatedField(
        source="home_branch", queryset=Branch.objects.all(),
        required=False, allow_null=True,
    )

    class Meta:
        model = Merchant
        fields = [
            "name", "shopName", "phone", "email", "password",
            "address", "district", "businessType", "homeBranchId",
        ]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated):
        email = validated.pop("email")
        password = validated.pop("password")
        user = User.objects.create_user(
            email=email, password=password,
            name=validated.get("name", ""), role=Role.MERCHANT,
        )
        return Merchant.objects.create(user=user, **validated)


class MerchantRegisterSerializer(serializers.ModelSerializer):
    """Public self-registration: creates a merchant + login user, PENDING approval."""

    email = serializers.EmailField(write_only=True)
    password = serializers.CharField(write_only=True, min_length=6)
    ownerName = serializers.CharField(source="name")
    shopName = serializers.CharField(source="shop_name")
    businessType = serializers.CharField(source="business_type", required=False, allow_blank=True)
    pickupAddress = serializers.CharField(source="address")

    class Meta:
        model = Merchant
        fields = [
            "shopName", "ownerName", "email", "phone", "password",
            "district", "businessType", "pickupAddress",
        ]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated):
        email = validated.pop("email")
        password = validated.pop("password")
        user = User.objects.create_user(
            email=email, password=password,
            name=validated.get("name", ""), role=Role.MERCHANT,
        )
        return Merchant.objects.create(user=user, **validated)


class MerchantUpdateSerializer(serializers.ModelSerializer):
    shopName = serializers.CharField(source="shop_name", required=False)
    businessType = serializers.CharField(source="business_type", required=False, allow_blank=True)

    class Meta:
        model = Merchant
        fields = ["name", "shopName", "phone", "address", "district", "businessType"]


class ApiKeySerializer(serializers.ModelSerializer):
    """Public metadata for a credential. Exposes the Api-Key (an identifier,
    safe to show) but never the Secret-Key (only its hash is stored)."""

    apiKey = serializers.CharField(source="api_key", read_only=True)
    isActive = serializers.BooleanField(source="is_active", read_only=True)
    lastUsedAt = serializers.DateTimeField(source="last_used_at", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = MerchantApiKey
        fields = ["id", "label", "apiKey", "isActive", "lastUsedAt", "createdAt"]


class WebhookSerializer(serializers.ModelSerializer):
    """A merchant's callback config: Callback URL + Auth Token (the bearer token
    we send back to them so they can verify the call)."""

    authToken = serializers.CharField(source="auth_token", required=False, allow_blank=True)
    isActive = serializers.BooleanField(source="is_active", required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = MerchantWebhook
        fields = ["url", "authToken", "isActive", "createdAt"]
        read_only_fields = ["createdAt"]


class WebhookDeliverySerializer(serializers.ModelSerializer):
    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    statusCode = serializers.IntegerField(source="status_code", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = WebhookDelivery
        fields = ["id", "event", "trackingId", "ok", "statusCode", "error", "createdAt"]
