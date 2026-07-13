from django.db import connection
from rest_framework import serializers
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.views import APIView

from .models import SiteSettings
from .pagination import paginate_queryset
from .permissions import IsAdmin


class BaseAPIView(APIView):
    """Shared helpers for our plain-APIView endpoints (no generics/viewsets)."""

    def paginate(self, queryset, request, **kwargs):
        return paginate_queryset(queryset, request, **kwargs)

    def paginated_response(self, page, data, status=200):
        return Response(
            {
                "results": data,
                "count": page.count,
                "page": page.page,
                "pageSize": page.page_size,
            },
            status=status,
        )


class HealthView(BaseAPIView):
    """Liveness + DB connectivity check."""

    permission_classes = [AllowAny]

    def get(self, request):
        try:
            with connection.cursor() as cur:
                cur.execute("SELECT 1")
                cur.fetchone()
            db_ok = True
        except Exception:
            db_ok = False
        return Response({"status": "ok", "database": db_ok})


class SiteSettingsSerializer(serializers.ModelSerializer):
    companyName = serializers.CharField(source="company_name", required=False)
    logo = serializers.ImageField(required=False, write_only=True, allow_null=True)
    logoUrl = serializers.SerializerMethodField()
    contactEmail = serializers.CharField(source="contact_email", required=False, allow_blank=True)
    contactPhone = serializers.CharField(source="contact_phone", required=False, allow_blank=True)
    contactAddress = serializers.CharField(source="contact_address", required=False, allow_blank=True)

    class Meta:
        model = SiteSettings
        fields = [
            "companyName", "logo", "logoUrl",
            "contactEmail", "contactPhone", "contactAddress",
        ]

    def get_logoUrl(self, obj):
        if not obj.logo:
            return None
        request = self.context.get("request")
        return request.build_absolute_uri(obj.logo.url) if request else obj.logo.url


class SiteSettingsView(BaseAPIView):
    """Public branding read; admin-only write (company name, logo, contact)."""

    parser_classes = [JSONParser, MultiPartParser, FormParser]

    def get_permissions(self):
        return [AllowAny()] if self.request.method == "GET" else [IsAdmin()]

    def get(self, request):
        return Response(
            SiteSettingsSerializer(SiteSettings.load(), context={"request": request}).data
        )

    def patch(self, request):
        obj = SiteSettings.load()
        ser = SiteSettingsSerializer(
            obj, data=request.data, partial=True, context={"request": request}
        )
        ser.is_valid(raise_exception=True)
        ser.save()
        return Response(SiteSettingsSerializer(obj, context={"request": request}).data)
