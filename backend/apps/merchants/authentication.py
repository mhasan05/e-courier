from django.utils import timezone
from rest_framework import authentication, exceptions

from .models import MerchantApiKey, hash_api_key


class ApiKeyAuthentication(authentication.BaseAuthentication):
    """Authenticates merchant API requests via `Api-Key` + `Secret-Key` headers
    (Steadfast convention).

    Resolves the key pair to its merchant and returns that merchant's User as
    request.user (so role/merchant scoping keeps working) and the key object as
    request.auth. Returns None when the `Api-Key` header is absent, so it never
    interferes with the web app's JWT auth.
    """

    def authenticate(self, request):
        api_key = request.headers.get("Api-Key")
        if not api_key:
            return None  # not a merchant-API request — let JWT/others handle it
        secret = request.headers.get("Secret-Key")
        if not secret:
            raise exceptions.AuthenticationFailed("Secret-Key header is required.")

        try:
            key = MerchantApiKey.objects.select_related("merchant__user").get(
                api_key=api_key, is_active=True
            )
        except MerchantApiKey.DoesNotExist:
            raise exceptions.AuthenticationFailed("Invalid or revoked API credentials.")

        if hash_api_key(secret) != key.secret_hash:
            raise exceptions.AuthenticationFailed("Invalid or revoked API credentials.")

        # Best-effort usage stamp (don't fail the request if it can't write).
        MerchantApiKey.objects.filter(pk=key.pk).update(last_used_at=timezone.now())

        request.api_key = key
        request.merchant = key.merchant
        return (key.merchant.user, key)

    def authenticate_header(self, request):
        return "Api-Key"
