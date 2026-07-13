from rest_framework.throttling import SimpleRateThrottle


class _PerMerchantThrottle(SimpleRateThrottle):
    """Base: throttle per authenticated merchant (API key resolves to a User)."""

    def get_cache_key(self, request, view):
        user = getattr(request, "user", None)
        if not user or not user.is_authenticated:
            return None
        return f"{self.scope}:{user.pk}"


class MerchantApiThrottle(_PerMerchantThrottle):
    scope = "merchant_api"  # burst, e.g. 120/min


class MerchantApiDayThrottle(_PerMerchantThrottle):
    scope = "merchant_api_day"  # daily cap, e.g. 10000/day
