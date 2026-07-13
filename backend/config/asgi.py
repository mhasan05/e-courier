"""ASGI entrypoint: HTTP via Django + WebSocket via Channels (JWT-authed)."""
import os

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings")

from django.core.asgi import get_asgi_application

# Initialize Django before importing anything that touches models/consumers.
django_asgi_app = get_asgi_application()

from channels.routing import ProtocolTypeRouter, URLRouter  # noqa: E402
from django.urls import path  # noqa: E402

from apps.common.ws_auth import JWTAuthMiddleware  # noqa: E402
from apps.notifications.consumers import NotificationConsumer  # noqa: E402
from apps.support.consumers import TicketConsumer  # noqa: E402

websocket_urlpatterns = [
    path("ws/notifications/", NotificationConsumer.as_asgi()),
    path("ws/support/<int:ticket_id>/", TicketConsumer.as_asgi()),
]

application = ProtocolTypeRouter(
    {
        "http": django_asgi_app,
        "websocket": JWTAuthMiddleware(URLRouter(websocket_urlpatterns)),
    }
)
