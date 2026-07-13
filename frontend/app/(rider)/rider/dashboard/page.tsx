"use client";

import Link from "next/link";
import {
  PackageCheck,
  Truck,
  CheckCircle2,
  RotateCcw,
  ChevronRight,
  Wallet,
  Send,
  Store,
  MapPin,
} from "lucide-react";
import PanelLoading from "@/components/layout/PanelLoading";
import { useParcels, collectedCodOf } from "@/lib/parcel-store";
import { getBranchById } from "@/lib/branch-store";
import { useRiderHandovers, cashInHandParcels } from "@/lib/rider-handover-store";
import { useRiderScope, parcelForRider, riderTaskOf } from "@/hooks/useRiderScope";
import { formatBDT } from "@/lib/utils";

export default function RiderDashboardPage() {
  const { deliveryManId, rider, loading } = useRiderScope();
  const all = useParcels();
  const handovers = useRiderHandovers();

  if (loading) return <PanelLoading />;
  if (deliveryManId == null || !rider) {
    return <p className="text-sm text-brown-500">No rider account.</p>;
  }

  const mine = all.filter((p) => parcelForRider(p, deliveryManId));
  const cashInHand = cashInHandParcels(all, handovers, deliveryManId).reduce(
    (s, p) => s + collectedCodOf(p),
    0,
  );
  const bucket = (b: string) => mine.filter((p) => riderTaskOf(p) === b);
  const pickups = bucket("pickup"); // to collect from merchants
  const deliveries = bucket("deliver"); // to deliver to customers
  const holding = bucket("transit"); // picked up, waiting to drop at hub
  const delivered = bucket("delivered").length;
  const refund = bucket("failed").length;
  const finished = delivered + refund;
  const successRate = finished ? Math.round((delivered / finished) * 100) : 0;
  const codCollected = mine.reduce((s, p) => s + collectedCodOf(p), 0);
  const hub = getBranchById(rider.branchId);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">
          Hi, {rider.name.split(" ")[0]} 👋
        </h1>
        <p className="text-xs text-brown-500">
          {hub ? `${hub.name} (${hub.code})` : "Your hub"}
        </p>
      </div>

      {/* Primary action — everything is done inside the Trip */}
      <Link
        href="/rider/trip"
        className="flex items-center justify-between rounded-2xl bg-gradient-to-br from-primary-700 to-primary p-4 text-white shadow-card active:opacity-95"
      >
        <div className="flex items-center gap-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15">
            <Truck className="h-5 w-5" />
          </span>
          <div>
            <p className="text-sm font-semibold">Start / continue your trip</p>
            <p className="text-xs text-primary-100">
              {deliveries.length} to deliver · {pickups.length} to pick up
            </p>
          </div>
        </div>
        <ChevronRight className="h-5 w-5" />
      </Link>

      {/* The two jobs — clearly separated */}
      <div className="space-y-3">
        {/* DELIVERIES */}
        <Link
          href="/rider/trip"
          className="block rounded-2xl border border-primary-100 bg-white p-4 shadow-card active:bg-canvas"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <MapPin className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brown-800">Deliveries</p>
                <span className="text-2xl font-bold text-primary">{deliveries.length}</span>
              </div>
              <p className="text-xs text-brown-500">
                Take these <b>to customers</b> and collect COD.
              </p>
            </div>
          </div>
          {deliveries.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-brown-100 pt-3">
              {deliveries.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-brown-700">
                    {p.recipientName} · {p.upazila || p.district}
                  </span>
                  <span className="shrink-0 font-medium text-brown-500">{formatBDT(p.codAmount)}</span>
                </div>
              ))}
              {deliveries.length > 3 && (
                <p className="text-xs text-primary">+{deliveries.length - 3} more in your trip</p>
              )}
            </div>
          )}
        </Link>

        {/* PICKUPS */}
        <Link
          href="/rider/trip"
          className="block rounded-2xl border border-warning-200 bg-white p-4 shadow-card active:bg-canvas"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-warning-50 text-warning-600">
              <Store className="h-6 w-6" />
            </span>
            <div className="flex-1">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-brown-800">Pickups</p>
                <span className="text-2xl font-bold text-warning-600">{pickups.length}</span>
              </div>
              <p className="text-xs text-brown-500">
                Collect these <b>from merchants</b>, then drop at your hub.
              </p>
            </div>
          </div>
          {pickups.length > 0 && (
            <div className="mt-3 space-y-1.5 border-t border-brown-100 pt-3">
              {pickups.slice(0, 3).map((p) => (
                <div key={p.id} className="flex items-center justify-between text-xs">
                  <span className="truncate text-brown-700">{p.merchantName}</span>
                  <span className="shrink-0 text-brown-400">{p.trackingId}</span>
                </div>
              ))}
              {pickups.length > 3 && (
                <p className="text-xs text-warning-600">+{pickups.length - 3} more</p>
              )}
            </div>
          )}
        </Link>
      </div>

      {/* Holding — picked up, still to hand to the hub */}
      {holding.length > 0 && (
        <div className="rounded-xl border border-info-200 bg-info-50/50 p-3 text-sm text-info-700">
          <PackageCheck className="mr-1 inline h-4 w-4" />
          You&apos;re carrying <b>{holding.length}</b> picked-up parcel(s) — drop them at your
          hub (they leave your list once you close the trip).
        </div>
      )}

      {/* Cash in hand */}
      {cashInHand > 0 && (
        <Link
          href="/rider/cod"
          className="flex items-center justify-between rounded-2xl border border-brown-100 bg-white p-4 shadow-card"
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-50 text-primary">
              <Wallet className="h-5 w-5" />
            </span>
            <div>
              <p className="text-xs text-brown-500">Cash in hand (COD collected)</p>
              <p className="text-xl font-semibold tracking-tight text-brown-800">{formatBDT(cashInHand)}</p>
            </div>
          </div>
          <span className="inline-flex items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-medium text-white">
            <Send className="h-3.5 w-3.5" /> Hand over
          </span>
        </Link>
      )}

      {/* Your performance — the rider's report at a glance */}
      <div>
        <p className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-brown-400">
          Your performance
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-brown-100 bg-white p-3 text-center shadow-card">
            <CheckCircle2 className="mx-auto h-5 w-5 text-primary" />
            <p className="mt-1 text-lg font-semibold text-brown-800">{delivered}</p>
            <p className="text-xs text-brown-500">Delivered</p>
          </div>
          <div className="rounded-xl border border-brown-100 bg-white p-3 text-center shadow-card">
            <RotateCcw className="mx-auto h-5 w-5 text-danger-500" />
            <p className="mt-1 text-lg font-semibold text-brown-800">{refund}</p>
            <p className="text-xs text-brown-500">Returned</p>
          </div>
          <div className="rounded-xl border border-brown-100 bg-white p-3 text-center shadow-card">
            <p className="text-lg font-semibold text-primary">{successRate}%</p>
            <p className="text-xs text-brown-500">Success rate</p>
          </div>
          <div className="rounded-xl border border-brown-100 bg-white p-3 text-center shadow-card">
            <p className="text-lg font-semibold text-success-600">
              {formatBDT(codCollected)}
            </p>
            <p className="text-xs text-brown-500">COD collected</p>
          </div>
        </div>
      </div>

      {/* Plain-language explainer */}
      <div className="rounded-xl border border-dashed border-brown-200 bg-white p-3 text-xs leading-relaxed text-brown-500">
        <p className="mb-1 font-semibold text-brown-600">How your day works</p>
        <p><b className="text-warning-600">Pickup</b> → go to the merchant, collect the parcel, then drop it at your hub.</p>
        <p><b className="text-primary">Delivery</b> → take the parcel from your hub to the customer and collect COD.</p>
        <p className="mt-1">Open your <b>Trip</b> to do both, then close it to hand in the cash.</p>
      </div>
    </div>
  );
}
