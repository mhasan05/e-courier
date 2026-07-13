from rest_framework import serializers

from apps.accounts.models import Role, User
from apps.branches.models import Branch

from .models import DEFAULT_RIDER_PASSWORD, DeliveryMan


def _abs_url(serializer, field):
    if not field:
        return None
    request = serializer.context.get("request")
    return request.build_absolute_uri(field.url) if request else field.url


class DeliveryManSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(source="user.email", read_only=True)
    photoUrl = serializers.SerializerMethodField()
    nidImageUrl = serializers.SerializerMethodField()
    passportImageUrl = serializers.SerializerMethodField()
    branchId = serializers.IntegerField(source="branch_id", read_only=True)
    createdAt = serializers.DateField(source="created_at", read_only=True)
    code = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryMan
        fields = [
            "id", "name", "phone", "email", "nid", "passport",
            "photoUrl", "nidImageUrl", "passportImageUrl",
            "status", "branchId", "areas", "createdAt", "code",
        ]

    def get_photoUrl(self, obj):
        return _abs_url(self, obj.photo)

    def get_nidImageUrl(self, obj):
        return _abs_url(self, obj.nid_image)

    def get_passportImageUrl(self, obj):
        return _abs_url(self, obj.passport_image)

    def get_code(self, obj):
        return f"DM-{obj.id:04d}"


class DeliveryManCreateSerializer(serializers.ModelSerializer):
    email = serializers.EmailField(write_only=True)
    branchId = serializers.PrimaryKeyRelatedField(
        source="branch", queryset=Branch.objects.all(), required=False, allow_null=True
    )
    areas = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = DeliveryMan
        fields = ["name", "phone", "email", "nid", "passport", "branchId", "areas"]

    def validate_email(self, value):
        value = value.lower()
        if User.objects.filter(email__iexact=value).exists():
            raise serializers.ValidationError("A user with this email already exists.")
        return value

    def create(self, validated):
        email = validated.pop("email")
        areas = validated.pop("areas", [])
        user = User.objects.create_user(
            email=email, password=DEFAULT_RIDER_PASSWORD,
            name=validated.get("name", ""), role=Role.DELIVERY_MAN,
        )
        rider = DeliveryMan.objects.create(user=user, **validated)
        # Constrain areas to the rider's hub coverage.
        if areas and rider.branch_id:
            allowed = set(rider.branch.coverage_thanas or [])
            rider.areas = [a for a in areas if a in allowed]
            rider.save(update_fields=["areas"])
        return rider


class DeliveryManUpdateSerializer(serializers.ModelSerializer):
    branchId = serializers.PrimaryKeyRelatedField(
        source="branch", queryset=Branch.objects.all(), required=False, allow_null=True
    )
    areas = serializers.ListField(child=serializers.CharField(), required=False)

    class Meta:
        model = DeliveryMan
        fields = ["name", "phone", "nid", "passport", "branchId", "areas"]


class DeliveryManDocumentsSerializer(serializers.ModelSerializer):
    class Meta:
        model = DeliveryMan
        fields = ["photo", "nid_image", "passport_image"]
