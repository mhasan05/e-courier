"use client";

import { useCallback, useEffect, useState } from "react";
import { Route, Bike, AlertTriangle, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import { listTrips, type Trip } from "@/lib/api/trips";
import { formatBDT, formatDateTime } from "@/lib/utils";

function progress(trip: Trip) {
  const deliveries = trip.items.filter((i) => i.direction === "delivery");
  const done = deliveries.filter((i) => i.outcome !== "pending").length;
  const pickups = trip.items.filter((i) => i.direction === "pickup").length;
  return { done, total: deliveries.length, pickups };
}

export default function BranchTripsPage() {
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    listTrips()
      .then(setTrips)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const open = trips.filter((t) => t.status === "in_progress");
  const closed = trips.filter((t) => t.status === "closed");

  // Outstanding dues: unreconciled closed trips where cash < COD collected.
  const duesByRider = new Map<string, number>();
  for (const t of closed) {
    const short = t.dueCod - t.collectedCod;
    if (!t.codReconciled && short > 0) {
      duesByRider.set(t.riderName ?? "—", (duesByRider.get(t.riderName ?? "—") ?? 0) + short);
    }
  }
  const dues = Array.from(duesByRider.entries()).sort((a, b) => b[1] - a[1]);

  if (loading) return <p className="p-6 text-sm text-brown-500">Loading trips…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-900">Rider Trips</h1>
        <p className="text-sm text-brown-500">
          Track riders out on delivery runs and reconcile COD cash when they return.
        </p>
      </div>

      {/* Outstanding rider dues */}
      {dues.length > 0 && (
        <Card
          title={
            <span className="flex items-center gap-2 text-danger-700">
              <AlertTriangle className="h-4 w-4" /> Outstanding rider dues
            </span>
          }
        >
          <div className="space-y-2">
            {dues.map(([rider, amount]) => (
              <div key={rider} className="flex items-center justify-between rounded-lg border border-danger-100 bg-danger-50/40 px-3 py-2">
                <span className="flex items-center gap-2 text-sm font-medium text-brown-800">
                  <Bike className="h-4 w-4 text-brown-400" /> {rider}
                </span>
                <span className="text-sm font-semibold text-danger-700">{formatBDT(amount)} owed</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* Open trips */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Route className="h-4 w-4" /> On the road ({open.length})
          </span>
        }
      >
        {open.length === 0 ? (
          <p className="text-sm text-brown-400">No riders currently out on a trip.</p>
        ) : (
          <div className="space-y-2">
            {open.map((t) => {
              const p = progress(t);
              return (
                <div key={t.id} className="rounded-lg border border-brown-100 p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm font-medium text-brown-800">{t.riderName}</p>
                      <p className="font-mono text-[11px] text-brown-500">{t.tripId}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-brown-500">Expected COD</p>
                      <p className="text-sm font-semibold text-brown-800">{formatBDT(t.expectedCod)}</p>
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap gap-2 text-xs">
                    <span className="rounded-full bg-brown-100 px-2 py-0.5 font-medium text-brown-600">
                      {p.done}/{p.total} delivered
                    </span>
                    {p.pickups > 0 && (
                      <span className="rounded-full bg-info-100 px-2 py-0.5 font-medium text-info-700">
                        {p.pickups} picked up
                      </span>
                    )}
                    <span className="text-brown-400">started {formatDateTime(t.startedAt)}</span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* Closed trips (reconciliation history) */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4" /> Closed trips
          </span>
        }
        bodyClassName="p-0"
      >
        {closed.length === 0 ? (
          <p className="p-4 text-sm text-brown-400">No closed trips yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-brown-100 bg-brown-50/50 text-[11px] uppercase tracking-wide text-brown-400">
                  <th className="px-4 py-2.5">Rider / Trip</th>
                  <th className="px-4 py-2.5">COD due</th>
                  <th className="px-4 py-2.5">Cash in</th>
                  <th className="px-4 py-2.5">Reconciliation</th>
                  <th className="px-4 py-2.5">Closed</th>
                </tr>
              </thead>
              <tbody>
                {closed.map((t) => {
                  const short = t.dueCod - t.collectedCod;
                  return (
                    <tr key={t.id} className="border-b border-brown-50 last:border-0">
                      <td className="px-4 py-2.5">
                        <p className="font-medium text-brown-800">{t.riderName}</p>
                        <p className="font-mono text-[11px] text-brown-500">{t.tripId}</p>
                      </td>
                      <td className="px-4 py-2.5 text-brown-700">{formatBDT(t.dueCod)}</td>
                      <td className="px-4 py-2.5 text-brown-700">{formatBDT(t.collectedCod)}</td>
                      <td className="px-4 py-2.5">
                        {t.codReconciled ? (
                          <Badge className="bg-success-100 text-success-700">Reconciled</Badge>
                        ) : short > 0 ? (
                          <Badge className="bg-danger-100 text-danger-700">Short {formatBDT(short)}</Badge>
                        ) : (
                          <Badge className="bg-warning-100 text-warning-700">Excess {formatBDT(-short)}</Badge>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-brown-500">
                        {t.closedAt ? formatDateTime(t.closedAt) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
