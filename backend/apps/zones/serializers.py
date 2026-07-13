from rest_framework import serializers

from .models import Zone


class ZoneSerializer(serializers.ModelSerializer):
    regularCharge = serializers.IntegerField(source="regular_charge")
    expressCharge = serializers.IntegerField(source="express_charge")
    codChargePercent = serializers.FloatField(source="cod_charge_percent")
    returnCharge = serializers.IntegerField(source="return_charge")
    isActive = serializers.BooleanField(source="is_active", required=False)

    class Meta:
        model = Zone
        fields = [
            "id", "name", "districts",
            "regularCharge", "expressCharge", "codChargePercent",
            "returnCharge", "isActive",
        ]


class QuoteSerializer(serializers.Serializer):
    district = serializers.CharField()
    deliveryType = serializers.ChoiceField(
        choices=["regular", "express"], default="regular"
    )
    weight = serializers.FloatField(default=0.5, min_value=0)
    codAmount = serializers.FloatField(default=0, min_value=0)
