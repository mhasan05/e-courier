from django.db.models import F, Q


def is_admin(user):
    return user.role in ("admin", "super_admin")


def _central_id():
    from apps.branches.models import Branch, BranchType

    return (
        Branch.objects.filter(type=BranchType.CENTRAL)
        .values_list("id", flat=True)
        .first()
    )


def scope_parcels(user, qs):
    """Restrict a parcel queryset to what the viewer may see.

    Chain of custody. A hub sees a parcel when it:
      (a) owns it (origin/COD hub) or ORIGINATED it — the sender always keeps
          visibility of its outbound parcels,
      (b) physically holds it (current hub),
      (c) it is in transit *toward* this hub (the "incoming" accept queue), or
      (d) for the central sorting hub, the parcel is anywhere in the active
          pipeline routed through it (so central never loses a parcel it has
          handled, even after the destination accepts it).
    A destination hub still does NOT see a parcel until it has actually been
    dispatched to it. Routing is origin → central → destination.
    """
    if is_admin(user):
        return qs
    if user.role == "merchant":
        merchant = getattr(user, "merchant", None)
        return qs.filter(merchant_id=merchant.id) if merchant else qs.none()
    if user.role == "branch_manager":
        b = user.branch_id
        # Owner (COD), origin (sender), and current holder always have visibility.
        scope = Q(owner_branch_id=b) | Q(origin_branch_id=b) | Q(current_branch_id=b)
        central = _central_id()
        if central is not None and b == central:
            # Central sorts every multi-hop parcel: it sees the whole in-transit
            # pipeline (forward or return) plus any routed parcel now resting past
            # its origin, until it is finally delivered/returned/closed.
            scope |= Q(status__in=["in_transit", "return_in_transit"]) | (
                ~Q(origin_branch_id=F("destination_branch_id"))
                & ~Q(current_branch_id=F("origin_branch_id"))
                & ~Q(status__in=["delivered", "partially_delivered", "returned", "cancelled"])
            )
        elif central is not None:
            # A spoke hub also sees parcels dispatched from central toward it.
            scope |= (
                Q(status="in_transit")
                & Q(current_branch_id=central)
                & Q(destination_branch_id=b)
            )
        return qs.filter(scope)
    if user.role == "delivery_man":
        rider = getattr(user, "delivery_man", None)
        return qs.filter(delivery_man_id=rider.id) if rider else qs.none()
    return qs.none()


def can_act_on(user, parcel):
    """Whether the viewer is allowed to mutate this parcel at all."""
    if is_admin(user):
        return True
    if user.role == "merchant":
        return parcel.merchant.user_id == user.id
    if user.role == "branch_manager":
        from apps.branches.routing import next_hop_branch_id

        b = user.branch_id
        # May act only on parcels it currently holds (dispatch / assign) or that
        # are in transit toward it (accept / reject) — never one it merely owns
        # or is the eventual destination of but hasn't received yet. Routing is
        # return-aware: a returning parcel heads toward its origin.
        if parcel.current_branch_id == b:
            return True
        target = parcel.origin_branch_id if parcel.returning else parcel.destination_branch_id
        if parcel.status in ("in_transit", "return_in_transit") and (
            next_hop_branch_id(parcel.current_branch_id, target) == b
        ):
            return True
        return False
    if user.role == "delivery_man":
        return parcel.delivery_man and parcel.delivery_man.user_id == user.id
    return False
