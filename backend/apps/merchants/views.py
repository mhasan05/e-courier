from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import AllowAny, IsAuthenticated
from rest_framework.response import Response

from apps.branches.models import Branch
from apps.common.permissions import IsAdmin
from apps.common.views import BaseAPIView

from .models import (
    Merchant,
    MerchantApiKey,
    MerchantStatus,
    MerchantWebhook,
)
from .serializers import (
    ApiKeySerializer,
    MerchantCreateSerializer,
    MerchantRegisterSerializer,
    MerchantSerializer,
    MerchantUpdateSerializer,
    WebhookDeliverySerializer,
    WebhookSerializer,
)


def _current_merchant(request):
    merchant = getattr(request.user, "merchant", None)
    if merchant is None:
        raise PermissionDenied("No merchant profile for this account.")
    return merchant


class MerchantListView(BaseAPIView):
    permission_classes = [IsAdmin]

    def get(self, request):
        qs = Merchant.objects.select_related("user").all()
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        q = request.query_params.get("q")
        if q:
            if q.upper().startswith("MCH-") and q[4:].isdigit():
                qs = qs.filter(pk=int(q[4:]))
            else:
                qs = qs.filter(
                    Q(name__icontains=q)
                    | Q(shop_name__icontains=q)
                    | Q(user__email__icontains=q)
                    | Q(phone__icontains=q)
                )
        page = self.paginate(qs, request)
        data = MerchantSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        ser = MerchantCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        merchant = ser.save()
        return Response(MerchantSerializer(merchant).data, status=201)


class MerchantRegisterView(BaseAPIView):
    """Public merchant self-registration; account starts PENDING admin approval."""

    permission_classes = [AllowAny]

    def post(self, request):
        ser = MerchantRegisterSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        merchant = ser.save()
        return Response(MerchantSerializer(merchant).data, status=201)


class MerchantMeView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = getattr(request.user, "merchant", None)
        if merchant is None:
            raise NotFound("No merchant profile for this account.")
        return Response(MerchantSerializer(merchant).data)


class MerchantDetailView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        merchant = get_object_or_404(Merchant.objects.select_related("user"), pk=pk)
        user = request.user
        is_admin = user.role in ("admin", "super_admin")
        if not is_admin and merchant.user_id != user.id:
            raise PermissionDenied("You can only access your own merchant profile.")
        return merchant

    def get(self, request, pk):
        return Response(MerchantSerializer(self.get_object(request, pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        merchant = self.get_object(request, pk)
        ser = MerchantUpdateSerializer(merchant, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(MerchantSerializer(merchant).data)


class MerchantStatusView(BaseAPIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        merchant = get_object_or_404(Merchant, pk=pk)
        status = request.data.get("status")
        if status not in MerchantStatus.values:
            return Response({"detail": "Invalid status.", "errors": {}}, status=400)
        merchant.status = status
        merchant.save(update_fields=["status"])
        return Response(MerchantSerializer(merchant).data)


class MerchantAssignBranchView(BaseAPIView):
    permission_classes = [IsAdmin]

    def patch(self, request, pk):
        merchant = get_object_or_404(Merchant, pk=pk)
        branch_id = request.data.get("homeBranchId")
        branch = get_object_or_404(Branch, pk=branch_id) if branch_id else None
        merchant.home_branch = branch
        merchant.save(update_fields=["home_branch"])
        return Response(MerchantSerializer(merchant).data)


class MerchantApiKeyListCreateView(BaseAPIView):
    """Merchant self-serve: list own API keys, or create one (secret shown once)."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = _current_merchant(request)
        return Response(ApiKeySerializer(merchant.api_keys.all(), many=True).data)

    def post(self, request):
        merchant = _current_merchant(request)
        label = (request.data.get("label") or "").strip()
        key, api_key, secret_key = MerchantApiKey.issue(merchant, label=label)
        data = ApiKeySerializer(key).data
        # The secret is returned only once, at creation.
        data["apiKey"] = api_key
        data["secretKey"] = secret_key
        return Response(data, status=201)


class MerchantApiKeyDetailView(BaseAPIView):
    """Merchant self-serve: revoke (delete) one of their API keys."""

    permission_classes = [IsAuthenticated]

    def delete(self, request, pk):
        merchant = _current_merchant(request)
        key = merchant.api_keys.filter(pk=pk).first()
        if key is None:
            raise NotFound("API key not found.")
        key.delete()
        return Response(status=204)


class MerchantWebhookView(BaseAPIView):
    """Merchant self-serve webhook config: GET current, PUT to set URL/active."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = _current_merchant(request)
        webhook = getattr(merchant, "webhook", None)
        if webhook is None:
            return Response({"url": "", "secret": "", "isActive": False, "createdAt": None})
        return Response(WebhookSerializer(webhook).data)

    def put(self, request):
        merchant = _current_merchant(request)
        webhook, _ = MerchantWebhook.objects.get_or_create(merchant=merchant)
        ser = WebhookSerializer(webhook, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(WebhookSerializer(webhook).data)


class MerchantWebhookDeliveriesView(BaseAPIView):
    """Recent webhook delivery attempts, for the dashboard log."""

    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = _current_merchant(request)
        qs = merchant.webhook_deliveries.all()[:25]
        return Response(WebhookDeliverySerializer(qs, many=True).data)
