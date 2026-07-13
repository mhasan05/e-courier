from rest_framework import serializers

from .models import AvailablePaymentMethod, MerchantPayoutMethod, WithdrawalRequest


class AvailablePaymentMethodSerializer(serializers.ModelSerializer):
    isActive = serializers.BooleanField(source="is_active", required=False)
    minAmount = serializers.IntegerField(source="min_amount", required=False)
    chargePercent = serializers.FloatField(source="charge_percent", required=False)

    class Meta:
        model = AvailablePaymentMethod
        fields = ["id", "name", "type", "isActive", "minAmount", "chargePercent", "instructions"]


class MerchantPayoutMethodSerializer(serializers.ModelSerializer):
    merchantId = serializers.IntegerField(source="merchant_id", read_only=True)
    methodId = serializers.PrimaryKeyRelatedField(
        source="method", queryset=AvailablePaymentMethod.objects.all()
    )
    methodName = serializers.CharField(source="method_name", required=False)
    accountName = serializers.CharField(source="account_name")
    accountNumber = serializers.CharField(source="account_number")
    bankName = serializers.CharField(source="bank_name", required=False, allow_blank=True)
    isDefault = serializers.BooleanField(source="is_default", required=False)

    class Meta:
        model = MerchantPayoutMethod
        fields = [
            "id", "merchantId", "methodId", "methodName", "type",
            "accountName", "accountNumber", "bankName", "branch", "isDefault",
        ]


class WithdrawalSerializer(serializers.ModelSerializer):
    merchantId = serializers.IntegerField(source="merchant_id", read_only=True)
    merchantName = serializers.SerializerMethodField()
    payoutMethodId = serializers.IntegerField(source="payout_method_id", read_only=True)
    payoutLabel = serializers.CharField(source="payout_label", read_only=True)
    requestedAt = serializers.DateField(source="requested_at", read_only=True)
    processedAt = serializers.DateField(source="processed_at", read_only=True)

    class Meta:
        model = WithdrawalRequest
        fields = [
            "id", "merchantId", "merchantName", "amount", "charge",
            "payoutMethodId", "payoutLabel", "status",
            "requestedAt", "processedAt", "reference", "note",
        ]

    def get_merchantName(self, obj):
        return obj.merchant.shop_name if obj.merchant_id else ""
