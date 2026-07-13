import type { Parcel } from "@/types";

// Recipient delivery-success history — a fraud/risk signal for COD parcels.
// Computed from the parcel store: among a phone number's *completed* parcels,
// how many were actually delivered vs returned (refused / unreachable). Mirrors
// the "success ratio" merchants rely on in BD courier platforms.

export type RecipientTier = "new" | "good" | "ok" | "risky";

export interface RecipientStats {
  total: number; // all parcels ever sent to this number
  delivered: number; // delivered + partially delivered
  returned: number; // returned + return in transit
  cancelled: number;
  inProgress: number; // not yet resolved
  completed: number; // delivered + returned (the denominator)
  successRate: number | null; // delivered / completed, null when no completed history
  tier: RecipientTier;
}

// Normalize a BD phone to its last 11 digits so "+8801…", "01…" and spaced
// variants all match.
function normalizePhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length > 11 ? digits.slice(-11) : digits;
}

function tierFor(rate: number | null): RecipientTier {
  if (rate == null) return "new";
  if (rate >= 0.8) return "good";
  if (rate >= 0.5) return "ok";
  return "risky";
}

// Returns null when the phone is too short to meaningfully match.
export function recipientStats(
  parcels: Parcel[],
  phone: string,
  excludeParcelId?: number,
): RecipientStats | null {
  const norm = normalizePhone(phone);
  if (norm.length < 6) return null;

  const matches = parcels.filter(
    (p) =>
      p.id !== excludeParcelId &&
      normalizePhone(p.recipientPhone) === norm,
  );

  let delivered = 0;
  let returned = 0;
  let cancelled = 0;
  let inProgress = 0;
  matches.forEach((p) => {
    if (p.status === "delivered" || p.status === "partially_delivered") delivered += 1;
    else if (p.status === "returned" || p.status === "return_in_transit") returned += 1;
    else if (p.status === "cancelled") cancelled += 1;
    else inProgress += 1;
  });

  const completed = delivered + returned;
  const successRate = completed > 0 ? delivered / completed : null;

  return {
    total: matches.length,
    delivered,
    returned,
    cancelled,
    inProgress,
    completed,
    successRate,
    tier: tierFor(successRate),
  };
}

export const TIER_META: Record<
  RecipientTier,
  { label: string; classes: string }
> = {
  new: { label: "New customer", classes: "bg-brown-100 text-brown-600" },
  good: { label: "Good", classes: "bg-primary-100 text-primary-700" },
  ok: { label: "Average", classes: "bg-amber-100 text-amber-700" },
  risky: { label: "High risk", classes: "bg-red-100 text-red-700" },
};
