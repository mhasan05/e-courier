from django.db.models import Q
from django.shortcuts import get_object_or_404
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.permissions import IsAdminOrBranchManager
from apps.common.views import BaseAPIView

from .models import DeliveryMan, DeliveryManStatus
from .serializers import (
    DeliveryManCreateSerializer,
    DeliveryManDocumentsSerializer,
    DeliveryManSerializer,
    DeliveryManUpdateSerializer,
)


def _is_admin(user):
    return user.role in ("admin", "super_admin")


def _scoped(user, qs):
    """Admin sees all riders; a branch manager sees only their hub's riders."""
    if _is_admin(user):
        return qs
    return qs.filter(branch_id=user.branch_id)


def _get_scoped_rider(request, pk):
    rider = get_object_or_404(DeliveryMan.objects.select_related("user"), pk=pk)
    if not _is_admin(request.user) and rider.branch_id != request.user.branch_id:
        raise PermissionDenied("This rider is not in your hub.")
    return rider


class RiderListView(BaseAPIView):
    permission_classes = [IsAdminOrBranchManager]

    def get(self, request):
        qs = _scoped(request.user, DeliveryMan.objects.select_related("user").all())
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(name__icontains=q) | Q(phone__icontains=q) | Q(user__email__icontains=q)
            )
        page = self.paginate(qs, request)
        data = DeliveryManSerializer(page.object_list, many=True, context={"request": request}).data
        return self.paginated_response(page, data)

    def post(self, request):
        ser = DeliveryManCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        # A branch manager can only create riders in their own hub.
        if not _is_admin(request.user):
            branch = ser.validated_data.get("branch")
            if branch is None or branch.id != request.user.branch_id:
                ser.validated_data["branch_id"] = request.user.branch_id
        rider = ser.save()
        return Response(
            DeliveryManSerializer(rider, context={"request": request}).data, status=201
        )


class RiderMeView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rider = getattr(request.user, "delivery_man", None)
        if rider is None:
            raise NotFound("No rider profile for this account.")
        return Response(DeliveryManSerializer(rider, context={"request": request}).data)


class RiderDetailView(BaseAPIView):
    permission_classes = [IsAdminOrBranchManager]

    def get(self, request, pk):
        return Response(
            DeliveryManSerializer(
                _get_scoped_rider(request, pk), context={"request": request}
            ).data
        )

    def put(self, request, pk):
        return self._update(request, pk, partial=False)

    def patch(self, request, pk):
        return self._update(request, pk, partial=True)

    def _update(self, request, pk, partial):
        rider = _get_scoped_rider(request, pk)
        ser = DeliveryManUpdateSerializer(rider, data=request.data, partial=partial)
        ser.is_valid(raise_exception=True)
        # A hub manager may edit their riders' details but not move them to
        # another hub (they'd lose access). Only admins can reassign hubs.
        if not _is_admin(request.user):
            ser.validated_data.pop("branch", None)
        # Areas a rider covers must be within their hub's coverage.
        if "areas" in ser.validated_data:
            allowed = set((rider.branch.coverage_thanas or []) if rider.branch_id else [])
            ser.validated_data["areas"] = [a for a in ser.validated_data["areas"] if a in allowed]
        ser.save()
        return Response(DeliveryManSerializer(rider, context={"request": request}).data)


class RiderStatusView(BaseAPIView):
    permission_classes = [IsAdminOrBranchManager]

    def patch(self, request, pk):
        rider = _get_scoped_rider(request, pk)
        status = request.data.get("status")
        if status not in DeliveryManStatus.values:
            return Response({"detail": "Invalid status.", "errors": {}}, status=400)
        rider.status = status
        rider.save(update_fields=["status"])
        return Response(DeliveryManSerializer(rider, context={"request": request}).data)


class RiderPasswordView(BaseAPIView):
    """Admin or the rider's hub manager resets the rider's login password."""

    permission_classes = [IsAdminOrBranchManager]

    def post(self, request, pk):
        rider = _get_scoped_rider(request, pk)
        password = (request.data.get("password") or "").strip()
        if len(password) < 6:
            return Response(
                {"detail": "Password must be at least 6 characters.", "errors": {}},
                status=400,
            )
        user = rider.user
        user.set_password(password)
        user.save(update_fields=["password"])
        return Response({"status": "ok"})


class RiderDocumentsView(BaseAPIView):
    permission_classes = [IsAdminOrBranchManager]
    parser_classes = [MultiPartParser, FormParser]

    def put(self, request, pk):
        rider = _get_scoped_rider(request, pk)
        ser = DeliveryManDocumentsSerializer(rider, data=request.data, partial=True)
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(DeliveryManSerializer(rider, context={"request": request}).data)
