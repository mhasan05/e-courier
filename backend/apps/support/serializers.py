from rest_framework import serializers

from .models import SupportMessage, SupportTicket


class SupportMessageSerializer(serializers.ModelSerializer):
    senderName = serializers.CharField(source="sender_name", read_only=True)
    attachment = serializers.SerializerMethodField()
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)

    class Meta:
        model = SupportMessage
        fields = ["id", "sender", "senderName", "body", "attachment", "createdAt"]

    def get_attachment(self, obj):
        if not obj.attachment:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.attachment.url) if request else obj.attachment.url


class SupportTicketSerializer(serializers.ModelSerializer):
    merchantId = serializers.IntegerField(source="merchant_id", read_only=True)
    merchantName = serializers.SerializerMethodField()
    trackingId = serializers.CharField(source="tracking_id", read_only=True)
    unreadForAdmin = serializers.BooleanField(source="unread_for_admin", read_only=True)
    unreadForMerchant = serializers.BooleanField(source="unread_for_merchant", read_only=True)
    createdAt = serializers.DateTimeField(source="created_at", read_only=True)
    updatedAt = serializers.DateTimeField(source="updated_at", read_only=True)
    messages = SupportMessageSerializer(many=True, read_only=True)

    class Meta:
        model = SupportTicket
        fields = [
            "id", "ref", "merchantId", "merchantName", "subject", "category",
            "priority", "status", "trackingId", "unreadForAdmin", "unreadForMerchant",
            "createdAt", "updatedAt", "messages",
        ]

    def get_merchantName(self, obj):
        return obj.merchant.shop_name if obj.merchant_id else ""


class TicketCreateSerializer(serializers.Serializer):
    subject = serializers.CharField()
    category = serializers.ChoiceField(choices=["parcel", "payment", "pickup", "account", "other"], default="other")
    priority = serializers.ChoiceField(choices=["low", "medium", "high"], default="medium")
    trackingId = serializers.CharField(required=False, allow_blank=True, default="")
    body = serializers.CharField()
    attachment = serializers.ImageField(required=False)


class MessageCreateSerializer(serializers.Serializer):
    body = serializers.CharField(required=False, allow_blank=True, default="")
    attachment = serializers.ImageField(required=False)
