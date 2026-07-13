from rest_framework import serializers

from .models import RiderNotification


class RiderNotificationSerializer(serializers.ModelSerializer):
    riderId = serializers.IntegerField(source="rider_id", read_only=True)
    parcelId = serializers.IntegerField(source="parcel_id", read_only=True)
    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = RiderNotification
        fields = ["id", "riderId", "type", "title", "body", "parcelId", "trackingId", "read", "createdAt"]
