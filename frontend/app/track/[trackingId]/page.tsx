"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowLeft, PackageX, Phone, Bike, Package, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Timeline from "@/components/ui/Timeline";
import LiveTrackingMap from "@/components/tracking/LiveTrackingMap";
import PanelLoading from "@/components/layout/PanelLoading";
import { useParcels } from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { useHydrated } from "@/hooks/useHydrated";
import { hubJourney } from "@/lib/hubs";
import { apiEnabled } from "@/lib/api";
import { trackParcel } from "@/lib/api/parcels";
import { cn } from "@/lib/utils";
import type { ParcelStatus, ParcelStatusEvent } from "@/types";

// Shape returned by the public /track/{id}/ endpoint (customer-facing).
interface TrackData {
  trackingId: string;
  status: ParcelStatus;
  recipientName: string;
  district: string;
  upazila?: string;
  merchantName: string;
  productDescription?: string;
  weight?: number;
  deliveryType?: string;
  originBranchId?: number;
  currentBranchId?: number;
  destinationBranchId?: number;
  deliveryMan?: { name: string; phone: string | null } | null;
  history: ParcelStatusEvent[];
}

export default function TrackParcelPage({
  params,
}: {
  params: { trackingId: string };
}) {
  const trackingId = decodeURIComponent(params.trackingId);
  const useApi = apiEnabled();

  // Mock sources (used when the API is disabled).
  const all = useParcels();
  const people = useDeliveryMen();
  useBranches();
  const hydrated = useHydrated();

  // API source (public endpoint — works for anonymous visitors).
  const [apiData, setApiData] = useState<TrackData | null>(null);
  const [apiLoading, setApiLoading] = useState(useApi);
  useEffect(() => {
    if (!useApi) return;
    let alive = true;
    setApiLoading(true);
    trackParcel(trackingId)
      .then((d) => alive && (setApiData(d as unknown as TrackData), setApiLoading(false)))
      .catch(() => alive && (setApiData(null), setApiLoading(false)));
    return () => {
      alive = false;
    };
  }, [useApi, trackingId]);

  const mockParcel = all.find(
    (p) => p.trackingId.toLowerCase() === trackingId.toLowerCase(),
  );
  const parcel: TrackData | null = useApi
    ? apiData
    : (mockParcel as unknown as TrackData) ?? null;

  if (useApi ? apiLoading : !hydrated) return <PanelLoading />;

  if (!parcel) {
    return (
      <div className="mx-auto max-w-md text-center">
        <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-danger-50 text-danger-500">
          <PackageX className="h-7 w-7" />
        </span>
        <h1 className="text-xl font-semibold tracking-tight text-brown-900">
          Parcel not found
        </h1>
        <p className="mt-1 text-sm text-brown-500">
          We couldn&apos;t find a parcel with tracking ID{" "}
          <span className="font-mono text-brown-600">{trackingId}</span>.
        </p>
        <Link
          href="/track"
          className="mt-4 inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          <ArrowLeft className="h-4 w-4" /> Try another ID
        </Link>
      </div>
    );
  }

  const deliveryComplete = ["delivered", "returned", "cancelled"].includes(
    parcel.status,
  );

  // Rider contact: from the API payload, or the mock rider store.
  const mockDm =
    !useApi && mockParcel
      ? people.find((d) => d.id === (mockParcel as { deliveryManId?: number }).deliveryManId)
      : undefined;
  const rider = useApi
    ? parcel.deliveryMan ?? null
    : mockDm
      ? { name: mockDm.name, phone: mockDm.phone }
      : null;

  // Hub journey needs branch names — available in mock / when logged in. For
  // anonymous API visitors the named timeline below narrates the same journey.
  const hubsKnown = getBranchById(parcel.originBranchId) != null;
  const journey = hubsKnown ? hubJourney(parcel as never) : [];
  const currentIndex = journey.indexOf(parcel.currentBranchId ?? -1);

  return (
    <div className="space-y-5">
      <Link
        href="/track"
        className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Track another parcel
      </Link>

      {/* Summary */}
      <Card>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <p className="font-mono text-sm text-brown-500">{parcel.trackingId}</p>
            <p className="text-xs text-brown-500">
              To {parcel.recipientName} ·{" "}
              {parcel.upazila ? `${parcel.upazila}, ` : ""}
              {parcel.district}
            </p>
          </div>
          <StatusBadge kind="parcel" status={parcel.status} />
        </div>
      </Card>

      {/* Live map */}
      <LiveTrackingMap
        status={parcel.status}
        originLabel={parcel.merchantName}
        destLabel={parcel.district}
      />

      {/* Hub journey (shown when hub names are available) */}
      {journey.length > 1 && (
        <Card title="Hub Journey">
          <ol className="flex items-center">
            {journey.map((hubId, i) => {
              const b = getBranchById(hubId);
              const done = parcel.status === "delivered" || i < currentIndex;
              const isCurrent = i === currentIndex && parcel.status !== "delivered";
              return (
                <li key={hubId} className="flex flex-1 items-center last:flex-none">
                  <div className="flex flex-col items-center text-center">
                    <span
                      className={cn(
                        "flex h-9 w-9 items-center justify-center rounded-full",
                        done
                          ? "bg-primary text-white"
                          : isCurrent
                            ? "bg-amber text-white ring-4 ring-amber-100"
                            : "bg-brown-100 text-brown-500",
                      )}
                    >
                      <Building2 className="h-4 w-4" />
                    </span>
                    <span className="mt-1 max-w-[6rem] text-xs font-medium text-brown-600">
                      {b?.name ?? "Hub"}
                    </span>
                    {isCurrent && (
                      <span className="text-[10px] font-medium text-warning-600">Current</span>
                    )}
                  </div>
                  {i < journey.length - 1 && (
                    <span
                      className={cn(
                        "mx-2 h-0.5 flex-1 rounded",
                        i < currentIndex || parcel.status === "delivered"
                          ? "bg-primary"
                          : "bg-brown-100",
                      )}
                    />
                  )}
                </li>
              );
            })}
          </ol>
        </Card>
      )}

      {/* Delivery man contact */}
      {rider ? (
        <Card title="Your Delivery Man">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
                {rider.name.charAt(0)}
              </span>
              <div>
                <p className="font-medium text-brown-800">{rider.name}</p>
                <p className="text-xs text-brown-500">
                  {deliveryComplete ? "Delivery completed" : "Assigned rider"}
                </p>
              </div>
            </div>
            {!deliveryComplete && rider.phone && (
              <a href={`tel:${rider.phone}`}>
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-white hover:bg-primary-700">
                  <Phone className="h-4 w-4" /> {rider.phone}
                </span>
              </a>
            )}
          </div>
        </Card>
      ) : (
        <Card title="Your Delivery Man">
          <p className="flex items-center gap-2 text-sm text-brown-500">
            <Bike className="h-4 w-4" /> A rider will be assigned soon.
          </p>
        </Card>
      )}

      {/* Parcel summary */}
      <Card title="Parcel">
        <div className="flex items-center gap-2 text-sm text-brown-700">
          <Package className="h-4 w-4 text-brown-400" />
          {parcel.productDescription || "Parcel"}
          {parcel.weight ? ` · ${parcel.weight} kg` : ""} ·{" "}
          <span className="capitalize">{parcel.deliveryType}</span>
        </div>
      </Card>

      {/* History */}
      <Card title="Tracking History">
        <Timeline events={parcel.history} />
      </Card>
    </div>
  );
}
