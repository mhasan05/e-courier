from django.shortcuts import get_object_or_404
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.common.views import BaseAPIView

from .models import (
    AvailablePaymentMethod,
    MerchantPayoutMethod,
    WithdrawalRequest,
    WithdrawalStatus,
)
from .serializers import (
    AvailablePaymentMethodSerializer,
    MerchantPayoutMethodSerializer,
    WithdrawalSerializer,
)


def _merchant(request):
    m = getattr(request.user, "merchant", None)
    if m is None:
        raise PermissionDenied("Merchant account required.")
    return m


def _is_admin(user):
    return user.role in ("admin", "super_admin")


# ---------------- Available methods (admin-managed) ----------------

class PaymentMethodListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        qs = AvailablePaymentMethod.objects.all()
        if not _is_admin(request.user):
            qs = qs.filter(is_active=True)
        page = self.paginate(qs, request)
        return self.paginated_response(page, AvailablePaymentMethodSerializer(page.object_list, many=True).data)

    def post(self, request):
        if not _is_admin(request.user):
            raise PermissionDenied("Admins only.")
        ser = AvailablePaymentMethodSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data, status=201)


class PaymentMethodDetailView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def get_object(self, pk):
        return get_object_or_404(AvailablePaymentMethod, pk=pk)

    def patch(self, request, pk):
        method = self.get_object(pk)
        ser = AvailablePaymentMethodSerializer(method, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ser.data)

    def put(self, request, pk):
        return self.patch(request, pk)


class PaymentMethodToggleView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        method = get_object_or_404(AvailablePaymentMethod, pk=pk)
        method.is_active = not method.is_active
        method.save(update_fields=["is_active"])
        return Response(AvailablePaymentMethodSerializer(method).data)


# ---------------- Merchant payout methods ----------------

class PayoutMethodListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        merchant = _merchant(request)
        qs = merchant.payout_methods.all()
        page = self.paginate(qs, request)
        return self.paginated_response(page, MerchantPayoutMethodSerializer(page.object_list, many=True).data)

    def post(self, request):
        merchant = _merchant(request)
        ser = MerchantPayoutMethodSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        method = ser.validated_data.get("method")
        is_first = not merchant.payout_methods.exists()
        make_default = ser.validated_data.get("is_default", False) or is_first
        if make_default:
            merchant.payout_methods.update(is_default=False)
        obj = ser.save(
            merchant=merchant,
            method_name=ser.validated_data.get("method_name") or (method.name if method else ""),
            is_default=make_default,
        )
        return Response(MerchantPayoutMethodSerializer(obj).data, status=201)


class PayoutMethodDetailView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get_object(self, request, pk):
        merchant = _merchant(request)
        obj = merchant.payout_methods.filter(pk=pk).first()
        if obj is None:
            raise NotFound("Payout method not found.")
        return obj

    def delete(self, request, pk):
        self.get_object(request, pk).delete()
        return Response(status=204)


class PayoutMethodDefaultView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def patch(self, request, pk):
        merchant = _merchant(request)
        obj = merchant.payout_methods.filter(pk=pk).first()
        if obj is None:
            raise NotFound("Payout method not found.")
        merchant.payout_methods.update(is_default=False)
        obj.is_default = True
        obj.save(update_fields=["is_default"])
        return Response(MerchantPayoutMethodSerializer(obj).data)


# ---------------- Withdrawals ----------------

class WithdrawalListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        if _is_admin(request.user):
            qs = WithdrawalRequest.objects.select_related("merchant").all()
            status = request.query_params.get("status")
            if status:
                qs = qs.filter(status=status)
        else:
            qs = _merchant(request).withdrawals.all()
        page = self.paginate(qs, request)
        return self.paginated_response(page, WithdrawalSerializer(page.object_list, many=True).data)

    def post(self, request):
        merchant = _merchant(request)
        amount = int(request.data.get("amount") or 0)
        if amount <= 0:
            return Response({"detail": "Amount must be positive.", "errors": {}}, status=400)
        payout = merchant.payout_methods.filter(pk=request.data.get("payoutMethodId")).first()
        if payout is None:
            return Response({"detail": "Select a valid payout method.", "errors": {}}, status=400)
        charge = 0
        if payout.method:
            charge = round(amount * payout.method.charge_percent / 100)
        wd = WithdrawalRequest.objects.create(
            merchant=merchant,
            amount=amount,
            charge=charge,
            payout_method=payout,
            payout_label=f"{payout.method_name} · {payout.account_number}",
            status=WithdrawalStatus.PENDING,
        )
        return Response(WithdrawalSerializer(wd).data, status=201)


class WithdrawalStatusView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsAdmin]

    def patch(self, request, pk):
        wd = get_object_or_404(WithdrawalRequest, pk=pk)
        status = request.data.get("status")
        if status not in WithdrawalStatus.values:
            return Response({"detail": "Invalid status.", "errors": {}}, status=400)
        wd.status = status
        wd.processed_at = timezone.localdate()
        if request.data.get("reference"):
            wd.reference = request.data["reference"]
        if request.data.get("note"):
            wd.note = request.data["note"]
        wd.save()
        return Response(WithdrawalSerializer(wd).data)
