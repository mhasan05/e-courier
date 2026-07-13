from django.shortcuts import get_object_or_404
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdmin
from apps.common.views import BaseAPIView

from .charges import compute_charge, find_zone_by_district
from .models import Zone
from .serializers import QuoteSerializer, ZoneSerializer


class ZoneListView(BaseAPIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdmin()]

    def get(self, request):
        qs = Zone.objects.all()
        page = self.paginate(qs, request)
        data = ZoneSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        ser = ZoneSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        zone = ser.save()
        return Response(ZoneSerializer(zone).data, status=201)


class ZoneDetailView(BaseAPIView):
    def get_permissions(self):
        return [IsAuthenticated()] if self.request.method == "GET" else [IsAdmin()]

    def get_object(self, pk):
        return get_object_or_404(Zone, pk=pk)

    def get(self, request, pk):
        return Response(ZoneSerializer(self.get_object(pk)).data)

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def delete(self, request, pk):
        self.get_object(pk).delete()
        return Response(status=204)

    def _update(self, request, pk, partial):
        zone = self.get_object(pk)
        ser = ZoneSerializer(zone, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(ZoneSerializer(zone).data)


class PricingQuoteView(BaseAPIView):
    """Server-authoritative charge quote (mirrors lib/charges.ts)."""

    permission_classes = [IsAuthenticated]

    def post(self, request):
        ser = QuoteSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        zone = find_zone_by_district(v["district"])
        if zone is None:
            return Response({"detail": "No active zone configured.", "errors": {}}, status=400)
        return Response(
            compute_charge(zone, v["deliveryType"], v["weight"], v["codAmount"])
        )
