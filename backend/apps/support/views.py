from django.db.models import Q
from django.utils import timezone
from rest_framework.exceptions import NotFound, PermissionDenied
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response

from apps.common.realtime import broadcast, ticket_group
from apps.common.views import BaseAPIView

from .models import SupportMessage, SupportTicket
from .serializers import (
    MessageCreateSerializer,
    SupportMessageSerializer,
    SupportTicketSerializer,
    TicketCreateSerializer,
)


def _is_admin(user):
    return user.role in ("admin", "super_admin")


def _actor_name(user):
    return user.name or user.email


def _scoped(request, qs):
    user = request.user
    if _is_admin(user):
        return qs
    if user.role == "merchant":
        merchant = getattr(user, "merchant", None)
        return qs.filter(merchant_id=merchant.id) if merchant else qs.none()
    return qs.none()


def _get_ticket(request, pk):
    ticket = _scoped(request, SupportTicket.objects.all()).filter(pk=pk).first()
    if ticket is None:
        raise NotFound("Ticket not found.")
    return ticket


class TicketListView(BaseAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def get(self, request):
        qs = _scoped(request, SupportTicket.objects.select_related("merchant").all())
        status = request.query_params.get("status")
        if status:
            qs = qs.filter(status=status)
        q = request.query_params.get("q")
        if q:
            qs = qs.filter(
                Q(ref__icontains=q) | Q(subject__icontains=q) | Q(merchant__shop_name__icontains=q)
            )
        page = self.paginate(qs, request)
        data = SupportTicketSerializer(page.object_list, many=True, context={"request": request}).data
        return self.paginated_response(page, data)

    def post(self, request):
        merchant = getattr(request.user, "merchant", None)
        if merchant is None:
            raise PermissionDenied("Only merchants can open tickets.")
        ser = TicketCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        now = timezone.now()
        ref = f"TKT-{SupportTicket.objects.count() + 1:04d}"
        ticket = SupportTicket.objects.create(
            ref=ref, merchant=merchant, subject=v["subject"], category=v["category"],
            priority=v["priority"], tracking_id=v.get("trackingId", ""),
            status="open", unread_for_admin=True, unread_for_merchant=False,
            created_at=now, updated_at=now,
        )
        SupportMessage.objects.create(
            ticket=ticket, sender="merchant", sender_name=merchant.name,
            body=v["body"], attachment=v.get("attachment"), created_at=now,
        )
        return Response(
            SupportTicketSerializer(ticket, context={"request": request}).data, status=201
        )


class TicketDetailView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request, pk):
        ticket = _get_ticket(request, pk)
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)

    def patch(self, request, pk):
        if not _is_admin(request.user):
            raise PermissionDenied("Only admins can change status/priority.")
        ticket = _get_ticket(request, pk)
        if "status" in request.data:
            ticket.status = request.data["status"]
        if "priority" in request.data:
            ticket.priority = request.data["priority"]
        ticket.updated_at = timezone.now()
        ticket.save()
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)


class TicketMessageView(BaseAPIView):
    permission_classes = [IsAuthenticated]
    parser_classes = [MultiPartParser, FormParser, JSONParser]

    def post(self, request, pk):
        ticket = _get_ticket(request, pk)
        ser = MessageCreateSerializer(data=request.data)
        ser.is_valid(raise_exception=True)
        v = ser.validated_data
        if not v.get("body") and not v.get("attachment"):
            return Response({"detail": "Message body or attachment required.", "errors": {}}, status=400)

        sender = "admin" if _is_admin(request.user) else "merchant"
        now = timezone.now()
        message = SupportMessage.objects.create(
            ticket=ticket, sender=sender, sender_name=_actor_name(request.user),
            body=v.get("body", ""), attachment=v.get("attachment"), created_at=now,
        )
        # Push the new message to anyone watching this ticket in real time.
        broadcast(
            ticket_group(ticket.id),
            "ticket.message",
            SupportMessageSerializer(message, context={"request": request}).data,
        )
        # Status workflow + unread flags (mirror the frontend store).
        if sender == "admin":
            if ticket.status == "open":
                ticket.status = "in_progress"
            ticket.unread_for_merchant = True
        else:
            if ticket.status in ("resolved", "closed"):
                ticket.status = "open"
            ticket.unread_for_admin = True
        ticket.updated_at = now
        ticket.save()
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)


class TicketReadView(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def post(self, request, pk):
        ticket = _get_ticket(request, pk)
        side = "admin" if _is_admin(request.user) else "merchant"
        if side == "admin":
            ticket.unread_for_admin = False
        else:
            ticket.unread_for_merchant = False
        ticket.save(update_fields=["unread_for_admin", "unread_for_merchant"])
        return Response(SupportTicketSerializer(ticket, context={"request": request}).data)
