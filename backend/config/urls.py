"""Root URL config. Each app exposes its own urls under /api/v1/."""
from django.conf import settings
from django.conf.urls.static import static
from django.contrib import admin
from django.urls import include, path

API = "api/v1/"

urlpatterns = [
    path("admin/", admin.site.urls),
    path(API, include("apps.common.urls")),
    path(API, include("apps.accounts.urls")),
    path(API, include("apps.branches.urls")),
    path(API, include("apps.zones.urls")),
    path(API, include("apps.merchants.urls")),
    path(API, include("apps.riders.urls")),
    path(API, include("apps.parcels.urls")),
    path(API, include("apps.pickups.urls")),
    path(API, include("apps.cod.urls")),
    path(API, include("apps.payments.urls")),
    path(API, include("apps.support.urls")),
    path(API, include("apps.notifications.urls")),
    path(API, include("apps.reports.urls")),
    # Public merchant API (API-key auth) for site integrations.
    path("api/merchant/v1/", include("apps.merchants.public_urls")),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
