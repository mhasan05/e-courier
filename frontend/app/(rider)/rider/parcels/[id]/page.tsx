"use client";

import Link from "next/link";
import { ArrowLeft, Phone, MapPin, Navigation, Wallet, Package, Route } from "lucide-react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Timeline from "@/components/ui/Timeline";
import PanelLoading from "@/components/layout/PanelLoading";
import { requireOwned } from "@/lib/scope";
import { useParcels, useParcelsReady, collectedCodOf } from "@/lib/parcel-store";
import { useRiderScope } from "@/hooks/useRiderScope";
import { formatBDT } from "@/lib/utils";

// Read-only parcel view for riders. All actions (pickup, deliver, fail) happen
// in the Trip runsheet, which reconciles COD — this is just for reference.
export default function RiderParcelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { deliveryManId, loading } = useRiderScope();
  const all = useParcels();
  const ready = useParcelsReady();
  const parcel = all.find((p) => p.id === Number(params.id));

  if (loading || !ready) return <PanelLoading />;
  requireOwned(parcel, deliveryManId != null && parcel?.deliveryManId === deliveryManId);

  const mapsHref = `https://maps.google.com/?q=${encodeURIComponent(
    `${parcel.recipientAddress}, ${parcel.upazila ?? ""}, ${parcel.district}`,
  )}`;

  const active = !["delivered", "returned", "cancelled"].includes(parcel.status);

  return (
    <div className="space-y-4 pb-2">
      <Link
        href="/rider/parcels"
        className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back
      </Link>

      <Card>
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-brown-500">{parcel.trackingId}</span>
          <StatusBadge kind="parcel" status={parcel.status} />
        </div>

        <div className="mt-3 space-y-2">
          <p className="text-base font-semibold text-brown-800">{parcel.recipientName}</p>
          <p className="flex items-start gap-2 text-sm text-brown-600">
            <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brown-400" />
            {parcel.recipientAddress}
            {parcel.upazila ? `, ${parcel.upazila}` : ""}, {parcel.district}
          </p>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2">
          <a
            href={`tel:${parcel.recipientPhone}`}
            className="flex items-center justify-center gap-1.5 rounded-lg bg-primary-50 py-2 text-sm font-medium text-primary-700"
          >
            <Phone className="h-4 w-4" /> Call
          </a>
          <a
            href={mapsHref}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center justify-center gap-1.5 rounded-lg bg-brown-100 py-2 text-sm font-medium text-brown-700"
          >
            <Navigation className="h-4 w-4" /> Directions
          </a>
        </div>

        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-brown-100 pt-3 text-sm">
          <div className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-brown-400" />
            {parcel.status === "partially_delivered" ? (
              <>
                <span className="font-semibold text-brown-800">{formatBDT(collectedCodOf(parcel))}</span>
                <span className="text-xs text-brown-500">of {formatBDT(parcel.codAmount)} COD</span>
              </>
            ) : (
              <>
                <span className="font-semibold text-brown-800">{formatBDT(parcel.codAmount)}</span>
                <span className="text-xs text-brown-500">COD</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-2">
            <Package className="h-4 w-4 text-brown-400" />
            <span className="capitalize text-brown-700">{parcel.deliveryType}</span>
            <span className="text-xs text-brown-500">{parcel.weight}kg</span>
          </div>
        </div>
      </Card>

      {active && (
        <Link
          href="/rider/trip"
          className="flex items-center justify-center gap-2 rounded-xl bg-primary py-2.5 text-sm font-semibold text-white"
        >
          <Route className="h-4 w-4" /> Manage in my trip
        </Link>
      )}

      <Card title="Tracking">
        <Timeline events={parcel.history} />
      </Card>
    </div>
  );
}
