import math

from .models import Zone


def round_half_up(value: float) -> int:
    """Match JS Math.round (round half away from zero for .5)."""
    return int(math.floor(value + 0.5))


def find_zone_by_district(district: str) -> Zone | None:
    active = list(Zone.objects.filter(is_active=True))
    for z in active:
        if district in (z.districts or []):
            return z
    return active[0] if active else Zone.objects.first()


def compute_charge(zone: Zone, delivery_type: str, weight: float, cod_amount: float) -> dict:
    """Mirror lib/charges.ts computeCharge.

    delivery = base(zone, type) + 10 per kg over 1kg
    cod      = max(10, cod_amount * cod_charge_percent / 100), or 0 when no COD
    """
    base = zone.express_charge if delivery_type == "express" else zone.regular_charge
    weight_extra = max(0, math.ceil((weight or 0) - 1)) * 10
    delivery_charge = round_half_up(base + weight_extra)
    if cod_amount and cod_amount > 0:
        cod_charge = max(10, round_half_up(cod_amount * zone.cod_charge_percent / 100))
    else:
        cod_charge = 0
    return {
        "zoneName": zone.name,
        "deliveryCharge": delivery_charge,
        "codCharge": cod_charge,
        "totalCharge": delivery_charge + cod_charge,
    }
