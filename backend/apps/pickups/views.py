from django.db.models import Count, Sum
from rest_framework.permissions import IsAuthenticated

from apps.common.permissions import IsAdminOrBranchManager
from apps.common.views import BaseAPIView
from apps.parcels.models import Parcel


class PickupRequestListView(BaseAPIView):
    """Pending parcels grouped per merchant → one pickup row each (admin/branch)."""

    permission_classes = [IsAuthenticated, IsAdminOrBranchManager]

    def get(self, request):
        qs = Parcel.objects.filter(status="pending")
        if request.user.role == "branch_manager":
            qs = qs.filter(owner_branch_id=request.user.branch_id)

        groups = (
            qs.values(
                "merchant_id",
                "merchant__shop_name",
                "merchant__phone",
                "merchant__address",
                "merchant__district",
                "owner_branch_id",
            )
            .annotate(parcelCount=Count("id"), totalCod=Sum("cod_amount"))
            .order_by("-parcelCount")
        )

        rows = [
            {
                "merchantId": g["merchant_id"],
                "merchantName": g["merchant__shop_name"],
                "phone": g["merchant__phone"],
                "pickupAddress": g["merchant__address"] or "—",
                "district": g["merchant__district"] or "",
                "hubId": g["owner_branch_id"],
                "parcelCount": g["parcelCount"],
                "totalCod": g["totalCod"] or 0,
            }
            for g in groups
        ]
        page = self.paginate(rows, request)
        return self.paginated_response(page, page.object_list)
