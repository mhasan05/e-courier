from rest_framework import serializers

from .models import HubRemittance, RiderHandover


class HubRemittanceSerializer(serializers.ModelSerializer):
    branchId = serializers.IntegerField(source="branch_id", read_only=True)
    parcelCount = serializers.IntegerField(source="parcel_count", read_only=True)
    remittedAt = serializers.DateField(source="remitted_at", read_only=True)
    receivedAt = serializers.DateField(source="received_at", read_only=True)

    class Meta:
        model = HubRemittance
        fields = [
            "id", "branchId", "amount", "parcelCount", "reference",
            "status", "note", "remittedAt", "receivedAt",
        ]


class RiderHandoverSerializer(serializers.ModelSerializer):
    riderId = serializers.IntegerField(source="rider_id", read_only=True)
    riderName = serializers.CharField(source="rider_name", read_only=True)
    branchId = serializers.IntegerField(source="branch_id", read_only=True)
    parcelCount = serializers.IntegerField(source="parcel_count", read_only=True)
    parcelIds = serializers.ListField(source="parcel_ids", read_only=True)
    remittedAt = serializers.DateField(source="remitted_at", read_only=True)
    receivedAt = serializers.DateField(source="received_at", read_only=True)
    confirmedBy = serializers.CharField(source="confirmed_by", read_only=True)

    class Meta:
        model = RiderHandover
        fields = [
            "id", "riderId", "riderName", "branchId", "amount", "parcelCount",
            "parcelIds", "reference", "status", "remittedAt", "receivedAt", "confirmedBy",
        ]
