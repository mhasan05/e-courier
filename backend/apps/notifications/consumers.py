from channels.generic.websocket import AsyncJsonWebsocketConsumer

from apps.common.realtime import rider_group


class NotificationConsumer(AsyncJsonWebsocketConsumer):
    """Per-rider notification stream. Connect to ws/notifications/?token=<JWT>."""

    async def connect(self):
        user = self.scope.get("user")
        if not user or not user.is_authenticated or user.role != "delivery_man":
            await self.close()
            return
        rider = await self._rider_id(user)
        if rider is None:
            await self.close()
            return
        self.group = rider_group(rider)
        await self.channel_layer.group_add(self.group, self.channel_name)
        await self.accept()

    async def disconnect(self, code):
        if hasattr(self, "group"):
            await self.channel_layer.group_discard(self.group, self.channel_name)

    async def notify_message(self, event):
        await self.send_json({"event": "notification", "data": event["payload"]})

    @staticmethod
    async def _rider_id(user):
        from channels.db import database_sync_to_async

        @database_sync_to_async
        def lookup():
            rider = getattr(user, "delivery_man", None)
            return rider.id if rider else None

        return await lookup()
