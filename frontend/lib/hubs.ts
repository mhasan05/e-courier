import { getBranches, getBranchById } from "@/lib/branch-store";
import type { Branch, Merchant, Parcel } from "@/types";

// Hub routing helpers. Mirror the zone helpers (lib/charges.ts) but resolve the
// operational hub for a parcel rather than its price.

/** Qualified coverage key — thana names aren't globally unique. */
export function thanaKey(district: string, thana?: string): string {
  return `${district}/${thana ?? ""}`;
}

// The delivery areas actively served in a district, derived from the active
// hubs' coverage (dynamic — no static geography). Coverage entries are
// "District/Thana"; returns sorted unique thana names for the given district.
export function coverageThanas(branches: Branch[], district: string): string[] {
  const prefix = `${district}/`;
  const set = new Set<string>();
  for (const b of branches) {
    if (!b.isActive) continue;
    for (const key of b.coverageThanas ?? []) {
      if (key.startsWith(prefix)) set.add(key.slice(prefix.length));
    }
  }
  return Array.from(set).sort((a, b) => a.localeCompare(b));
}

// Returns undefined while the branch store is still loading from the API
// (empty on first render) — callers must guard.
export function centralHub(): Branch | undefined {
  const branches = getBranches();
  return branches.find((b) => b.type === "central") ?? branches[0];
}

/** Resolve the delivery hub for a recipient's district + thana. */
export function resolveDestinationHub(district: string, thana?: string): Branch | undefined {
  const active = getBranches().filter((b) => b.isActive);
  const key = thanaKey(district, thana);
  return (
    active.find((b) => b.coverageThanas.includes(key)) ??
    active.find((b) => b.coverageThanas.some((t) => t.startsWith(district + "/"))) ??
    centralHub()
  );
}

/** Origin hub = the merchant's home hub (or central as a fallback). */
export function resolveOriginHub(
  merchant: Pick<Merchant, "homeBranchId" | "district">,
): Branch | undefined {
  return (
    getBranchById(merchant.homeBranchId) ??
    resolveDestinationHub(merchant.district) ??
    centralHub()
  );
}

export function branchLabel(id?: number | null): string {
  const b = getBranchById(id);
  return b ? `${b.name} (${b.code})` : "—";
}

// ---- Inter-hub routing (central sorting hub) ----

// The next hub a parcel should move to from where it currently is.
// Routing goes: origin → central → destination (skipping central when current
// or destination already is central). Returns null when it's at its destination.
export function nextHopBranchId(p: Parcel): number | null {
  const cur = p.currentBranchId;
  // Return-aware: a returning parcel routes back toward its origin hub.
  const target = p.returning ? p.originBranchId : p.destinationBranchId;
  if (cur == null || target == null) return null;
  if (cur === target) return null;
  const central = centralHub();
  if (central == null) return null; // branches still loading
  if (cur === central.id) return target;
  return central.id;
}

// Ordered, de-duplicated list of hub ids the parcel travels through.
export function hubJourney(p: Parcel): number[] {
  const o = p.originBranchId;
  const d = p.destinationBranchId;
  if (o == null || d == null) return [];
  if (o === d) return [o];
  const central = centralHub();
  const ids = central == null ? [o, d] : [o, central.id, d];
  return ids.filter((v, i, a) => a.indexOf(v) === i);
}
