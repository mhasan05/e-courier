from apps.parcels.models import Parcel
from apps.parcels.services import collected_cod_of

from .models import RiderHandover


def handed_over_parcel_ids(rider_id) -> set:
    ids = set()
    for h in RiderHandover.objects.filter(rider_id=rider_id):
        ids.update(h.parcel_ids or [])
    return ids


def cash_in_hand_parcels(rider_id):
    """Delivered/partial parcels a rider collected COD on but hasn't handed over."""
    settled = handed_over_parcel_ids(rider_id)
    out = []
    qs = Parcel.objects.filter(
        delivery_man_id=rider_id,
        status__in=["delivered", "partially_delivered"],
    )
    for p in qs:
        if p.id in settled:
            continue
        if collected_cod_of(p) > 0:
            out.append(p)
    return out


def next_reference(model, prefix):
    last_id = model.objects.count() + 1
    return f"{prefix}-{last_id:04d}"
