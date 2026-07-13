"""Hub routing — ports lib/hubs.ts. Functions take ids (not model instances of
other apps) so parcels/merchants can call them without circular imports."""
from .models import Branch, BranchType


def thana_key(district: str, thana: str | None = None) -> str:
    return f"{district}/{thana or ''}"


def central_hub() -> Branch | None:
    central = Branch.objects.filter(type=BranchType.CENTRAL).first()
    return central or Branch.objects.first()


def resolve_destination_hub(district: str, thana: str | None = None) -> Branch | None:
    active = list(Branch.objects.filter(is_active=True))
    key = thana_key(district, thana)
    for b in active:
        if key in (b.coverage_thanas or []):
            return b
    prefix = f"{district}/"
    for b in active:
        if any(str(t).startswith(prefix) for t in (b.coverage_thanas or [])):
            return b
    return central_hub()


def resolve_origin_hub(home_branch_id, district: str) -> Branch | None:
    if home_branch_id:
        b = Branch.objects.filter(id=home_branch_id).first()
        if b:
            return b
    return resolve_destination_hub(district) or central_hub()


def next_hop_branch_id(current_id, dest_id):
    """Next hub along origin → central → destination. None at destination."""
    if current_id is None or dest_id is None or current_id == dest_id:
        return None
    central = central_hub()
    central_id = central.id if central else None
    if current_id == central_id:
        return dest_id
    return central_id


def hub_journey(origin_id, dest_id) -> list:
    if origin_id is None or dest_id is None:
        return []
    if origin_id == dest_id:
        return [origin_id]
    central = central_hub()
    central_id = central.id if central else None
    ordered = [origin_id, central_id, dest_id]
    seen, out = set(), []
    for v in ordered:
        if v is not None and v not in seen:
            seen.add(v)
            out.append(v)
    return out


# Ensure the given thanas belong only to `owner` (removed from other hubs).
def claim_coverage(owner: Branch, thanas: list) -> None:
    claimed = set(thanas or [])
    if not claimed:
        return
    for b in Branch.objects.exclude(pk=owner.pk):
        current = b.coverage_thanas or []
        filtered = [t for t in current if t not in claimed]
        if len(filtered) != len(current):
            b.coverage_thanas = filtered
            b.save(update_fields=["coverage_thanas"])
