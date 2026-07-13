from channels.db import database_sync_to_async
from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.common.realtime import ticket_group


class TicketConsumer(AsyncJsonWebsocketConsumer):
    """Live message stream for one ticket. Connect to ws/support/<id>/?token=<JWT>.
    Only the owning merchant or an admin may subscribe."""

    async def connect(self):
        user = self.scope.get("user")
        self.ticket_id = self.scope["url_route"]["kwargs"]["ticket_id"]
        if not user or not user.is_authenticated or not await self._can_access(user, self.ticket_id):
            await self.close()
            return
        self.group = ticket_group(self.ticket_id)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def ticket_message(self, event):
        await self.send_json({"event": "message", "data": event["payload"]})

    @staticmethod
    @database_sync_to_async
    def _can_access(user, ticket_id):
        from .models import SupportTicket

        ticket = SupportTicket.objects.filter(pk=ticket_id).select_related("merchant").first()
        if ticket is None:
            return False
        if user.role in ("admin", "super_admin"):
            return True
        merchant = getattr(user, "merchant", None)
        return bool(merchant and ticket.merchant_id == merchant.id)
