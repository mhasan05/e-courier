import type { Parcel, ParcelStatus } from "@/types";
import { PARCEL_STATUS_META } from "@/lib/constants";

// Derived data helpers for dashboard + report charts. All operate on plain
// arrays so they work equally well over mock data (M2) or API data (M6+).

export interface DailyPoint {
  date: string; // "12 Jun"
  count: number;
}

// Build a 7-day volume series ending at the most recent parcel date in the set
// (anchoring to the data keeps the demo chart populated regardless of "today").
export function dailyVolume(parcels: Parcel[], days = 7): DailyPoint[] {
  if (parcels.length === 0) return [];
  const maxTime = Math.max(
    ...parcels.map((p) => new Date(p.createdAt).getTime()),
  );
  const anchor = new Date(maxTime);
  const points: DailyPoint[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(anchor);
    d.setDate(anchor.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    const count = parcels.filter((p) => p.createdAt.slice(0, 10) === key).length;
    points.push({
      date: d.toLocaleDateString("en-GB", { day: "2-digit", month: "short" }),
      count,
    });
  }
  return points;
}

export interface StatusSlice {
  name: string;
  value: number;
  color: string;
}

// Group parcels into Delivered / Returned / Pending(in-progress) buckets for
// the dashboard pie. "Pending" here means anything still in motion.
export function deliveryBreakdown(parcels: Parcel[]): StatusSlice[] {
  const delivered = parcels.filter((p) => p.status === "delivered").length;
  const returned = parcels.filter(
    (p) => p.status === "returned" || p.status === "return_in_transit",
  ).length;
  const pending = parcels.length - delivered - returned;
  return [
    { name: "Delivered", value: delivered, color: "#059669" },
    { name: "Returned", value: returned, color: "#dc2626" },
    { name: "Pending", value: pending, color: "#f59e0b" },
  ];
}

export interface StatusCount {
  status: ParcelStatus;
  label: string;
  count: number;
  percentage: number;
}

export function statusCounts(parcels: Parcel[]): StatusCount[] {
  const total = parcels.length || 1;
  const statuses = Object.keys(PARCEL_STATUS_META) as ParcelStatus[];
  return statuses
    .map((status) => {
      const count = parcels.filter((p) => p.status === status).length;
      return {
        status,
        label: PARCEL_STATUS_META[status].label,
        count,
        percentage: Math.round((count / total) * 100),
      };
    })
    .filter((s) => s.count > 0);
}

export function successRate(parcels: Parcel[]): number {
  const finished = parcels.filter((p) =>
    ["delivered", "returned"].includes(p.status),
  ).length;
  const delivered = parcels.filter((p) => p.status === "delivered").length;
  if (finished === 0) return 0;
  return Math.round((delivered / finished) * 100);
}

// COD money view: cash already collected on delivered parcels vs. cash still
// expected from parcels that are in motion (not yet delivered, not returned).
export interface CodSummary {
  collected: number; // cash actually received at delivery
  pending: number; // COD still to be collected on active parcels
  deliveredCount: number;
}

export function codSummary(parcels: Parcel[]): CodSummary {
  let collected = 0;
  let pending = 0;
  let deliveredCount = 0;
  for (const p of parcels) {
    if (p.status === "delivered") {
      collected += p.collectedCod ?? p.codAmount;
      deliveredCount += 1;
    } else if (p.status === "partially_delivered") {
      collected += p.collectedCod ?? 0;
    } else if (
      !["returned", "return_in_transit", "cancelled"].includes(p.status)
    ) {
      pending += p.codAmount;
    }
  }
  return { collected, pending, deliveredCount };
}

// Operational pipeline view — where the parcels currently sit. Used by hub and
// central reports to show the flow at a glance rather than raw status codes.
export interface OpBreakdown {
  pending: number; // awaiting pickup from merchant
  inTransit: number; // moving between hubs (incl. returns in transit)
  atHub: number; // sitting at a hub, sorted/awaiting next hop
  outForDelivery: number; // with a rider heading to the customer
  delivered: number;
  returned: number;
  cancelled: number;
}

export function opBreakdown(parcels: Parcel[]): OpBreakdown {
  const b: OpBreakdown = {
    pending: 0,
    inTransit: 0,
    atHub: 0,
    outForDelivery: 0,
    delivered: 0,
    returned: 0,
    cancelled: 0,
  };
  for (const p of parcels) {
    switch (p.status) {
      case "pending":
        b.pending += 1;
        break;
      case "picked_up":
      case "in_transit":
      case "return_in_transit":
        b.inTransit += 1;
        break;
      case "at_hub":
        b.atHub += 1;
        break;
      case "out_for_delivery":
        b.outForDelivery += 1;
        break;
      case "delivered":
      case "partially_delivered":
        b.delivered += 1;
        break;
      case "returned":
        b.returned += 1;
        break;
      case "cancelled":
        b.cancelled += 1;
        break;
    }
  }
  return b;
}
