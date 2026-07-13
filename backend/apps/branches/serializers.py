from rest_framework import serializers

from apps.accounts.models import Role

from .models import Branch


class BranchSerializer(serializers.ModelSerializer):
    """camelCase I/O to match the frontend Branch type."""

    coverageThanas = serializers.ListField(
        child=serializers.CharField(), source="coverage_thanas", required=False
    )
    isActive = serializers.BooleanField(source="is_active", required=False)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    managerUserId = serializers.SerializerMethodField()

    class Meta:
        model = Branch
        fields = [
            "id", "name", "code", "type", "phone", "address",
            "district", "thana", "coverageThanas", "isActive",
            "managerUserId", "createdAt",
        ]

    def get_managerUserId(self, obj):
        manager = obj.staff.filter(role=Role.BRANCH_MANAGER).first()
        return manager.id if manager else None

    def validate_code(self, value):
        qs = Branch.objects.filter(code__iexact=value)
        if self.instance:
            qs = qs.exclude(pk=self.instance.pk)
        if qs.exists():
            raise serializers.ValidationError("A branch with this code already exists.")
        return value
