from django.shortcuts import get_object_or_404
from rest_framework.exceptions import PermissionDenied
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.views import BaseAPIView

from .models import RiderNotification
from .serializers import RiderNotificationSerializer


def _rider(request):
    rider = getattr(request.user, "delivery_man", None)
    if rider is None:
        raise PermissionDenied("Riders only.")
    return rider


class NotificationListView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        rider = _rider(request)
        qs = RiderNotification.objects.filter(rider_id=rider.id)
        page = self.paginate(qs, request)
        return self.paginated_response(page, RiderNotificationSerializer(page.object_list, many=True).data)


class NotificationReadView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        rider = _rider(request)
        note = get_object_or_404(RiderNotification, pk=pk, rider_id=rider.id)
        note.read = True
        note.save(update_fields=["read"])
        return Response(RiderNotificationSerializer(note).data)


class NotificationReadAllView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request):
        rider = _rider(request)
        RiderNotification.objects.filter(rider_id=rider.id, read=False).update(read=True)
        return Response({"detail": "All notifications marked read."})
