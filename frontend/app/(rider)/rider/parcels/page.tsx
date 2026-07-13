"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, Route } from "lucide-react";
import StatusBadge from "@/components/ui/StatusBadge";
import { useParcels } from "@/lib/parcel-store";
import { useRiderScope, parcelForRider } from "@/hooks/useRiderScope";
import { formatBDT, cn } from "@/lib/utils";
import type { ParcelStatus } from "@/types";

// Read-only reference list of the rider's parcels. All actions (pickup, deliver,
// submit) happen in the Trip runsheet — this is just for looking things up.
const FILTERS: { label: string; value: string; match: (s: ParcelStatus) => boolean }[] = [
  { label: "Active", value: "active", match: (s) => !["delivered", "returned", "cancelled"].includes(s) },
  { label: "Delivered", value: "delivered", match: (s) => s === "delivered" || s === "partially_delivered" },
  { label: "Closed", value: "closed", match: (s) => ["returned", "cancelled", "return_in_transit"].includes(s) },
  { label: "All", value: "all", match: () => true },
];

export default function RiderParcelsPage() {
  const { deliveryManId } = useRiderScope();
  const all = useParcels();
  const [tab, setTab] = useState("active");

  const mine = useMemo(
    () => (deliveryManId == null ? [] : all.filter((p) => parcelForRider(p, deliveryManId))),
    [all, deliveryManId],
  );
  const matcher = FILTERS.find((f) => f.value === tab)?.match ?? (() => true);
  const list = mine
    .filter((p) => matcher(p.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  return (
    <div className="space-y-4">
      <Link
        href="/rider/trip"
        className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
      >
        <Route className="h-4 w-4" /> Go to my trip
      </Link>

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-brown-100 bg-white p-1">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            onClick={() => setTab(f.value)}
            className={cn(
              "flex-1 whitespace-nowrap rounded-lg px-2 py-1.5 text-xs font-medium transition-colors",
              f.value === tab ? "bg-primary text-white" : "text-brown-500",
            )}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="space-y-2">
        {list.length === 0 ? (
          <p className="rounded-xl border border-dashed border-brown-200 bg-white p-6 text-center text-sm text-brown-500">
            No parcels here.
          </p>
        ) : (
          list.map((p) => (
            <Link
              key={p.id}
              href={`/rider/parcels/${p.id}`}
              className="flex items-start gap-3 rounded-xl border border-brown-100 bg-white p-3 shadow-card"
            >
              <div className="min-w-0 flex-1">
                <p className="font-mono text-[11px] text-brown-500">{p.trackingId}</p>
                <p className="truncate text-sm font-medium text-brown-800">{p.recipientName}</p>
                <p className="truncate text-xs text-brown-500">
                  {p.recipientAddress}, {p.upazila ? `${p.upazila}, ` : ""}{p.district}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <StatusBadge kind="parcel" status={p.status} />
                <span className="text-xs font-semibold text-brown-700">{formatBDT(p.codAmount)}</span>
              </div>
              <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brown-400" />
            </Link>
          ))
        )}
      </div>
    </div>
  );
}
