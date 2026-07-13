"use client";

import { useAuth } from "@/hooks/useAuth";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { nextHopBranchId, centralHub } from "@/lib/hubs";
import type { Branch, Parcel } from "@/types";

const TERMINAL_STATUSES = ["delivered", "partially_delivered", "returned", "cancelled"];

// Resolves the current viewer's hub scope.
//  - HQ (admin / super_admin): branchId = null  → sees everything.
//  - Branch manager: branchId = their hub → all data is filtered to it.
export function useBranchScope(): {
  branchId: number | null;
  branch: Branch | null;
} {
  const { branchId } = useAuth();
  useBranches(); // subscribe so the branch object stays current
  return { branchId: branchId ?? null, branch: getBranchById(branchId) ?? null };
}

// Chain of custody: a hub sees a parcel when it owns it (ownerBranchId), it
// originated there (origin/sender keeps visibility of its outbound parcels), it
// physically holds it (currentBranchId), or it is in transit *toward* this hub
// (the incoming queue). The destination hub still does NOT see it until Central
// dispatches it onward. The central sorting hub additionally keeps visibility of
// the whole active pipeline routed through it (so it never loses a parcel it
// handed off to the destination). Mirrors backend scope_parcels.
export function parcelInBranch(p: Parcel, branchId: number): boolean {
  if (
    p.ownerBranchId === branchId ||
    p.originBranchId === branchId ||
    p.currentBranchId === branchId ||
    parcelIncomingToBranch(p, branchId)
  ) {
    return true;
  }
  const central = centralHub();
  if (central && branchId === central.id) {
    if (p.status === "in_transit") return true;
    const multiHop = p.originBranchId !== p.destinationBranchId;
    const active = !TERMINAL_STATUSES.includes(p.status);
    if (multiHop && p.currentBranchId !== p.originBranchId && active) return true;
  }
  return false;
}

// Inbound to this hub, dispatched from the previous hub and awaiting its
// acceptance (the "Incoming" queue where Accept / Reject live).
export function parcelIncomingToBranch(p: Parcel, branchId: number): boolean {
  return p.status === "in_transit" && nextHopBranchId(p) === branchId;
}

// Physically resting at this hub (accepted, not in flight) — ready to be
// dispatched onward or, if this is the destination, assigned for delivery.
export function parcelAtBranch(p: Parcel, branchId: number): boolean {
  return p.currentBranchId === branchId && p.status !== "in_transit";
}
