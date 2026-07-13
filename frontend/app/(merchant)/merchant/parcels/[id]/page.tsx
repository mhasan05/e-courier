"use client";

import Link from "next/link";
import {
  ArrowLeft,
  Printer,
  User,
  MapPin,
  Weight,
  Package,
  Wallet,
  XCircle,
  Bike,
  Phone,
  MapPinned,
} from "lucide-react";
import { useState } from "react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Timeline from "@/components/ui/Timeline";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import PanelLoading from "@/components/layout/PanelLoading";
import RecipientRisk from "@/components/parcels/RecipientRisk";
import Barcode from "@/components/parcels/Barcode";
import { useToast } from "@/components/ui/Toast";
import { useParcels, setParcelStatus } from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { requireOwned } from "@/lib/scope";
import { formatBDT, formatDateTime } from "@/lib/utils";

export default function MerchantParcelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const toast = useToast();
  const { loading } = useAuth();
  const hydrated = useHydrated();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useParcels();
  const people = useDeliveryMen();
  const parcel = all.find((p) => p.id === Number(params.id));
  const [confirmCancel, setConfirmCancel] = useState(false);

  // Wait for the session + persisted stores before judging scope, then guard:
  // merchants can only view their own parcels.
  if (loading || !hydrated) return <PanelLoading />;
  requireOwned(parcel, parcel?.merchantId === me.id);

  // The merchant should only see the delivery rider once the parcel is in its
  // final-delivery stage (assigned by the destination hub) — never the origin
  // hub's pickup rider. Reveal when out-for-delivery/completed, or when the
  // parcel is resting at its destination hub with a rider assigned.
  const atDestination = parcel.currentBranchId === parcel.destinationBranchId;
  const finalDeliveryStage =
    ["out_for_delivery", "delivered", "partially_delivered"].includes(parcel.status) ||
    (atDestination && parcel.deliveryManId != null);
  const assignedDm = finalDeliveryStage
    ? people.find((d) => d.id === parcel.deliveryManId)
    : undefined;

  // Hide internal "assigned to delivery man" events (incl. the pickup rider)
  // from the merchant's timeline — they only see status milestones + hub moves.
  const merchantHistory = parcel.history.filter(
    (e) => !/assigned to delivery man/i.test(e.remark ?? ""),
  );

  const doCancel = () => {
    setParcelStatus(parcel.id, "cancelled", "Cancelled by merchant");
    toast.success(`${parcel.trackingId} cancelled`);
    setConfirmCancel(false);
  };

  const recipientRows = [
    { icon: User, label: "Name", value: `${parcel.recipientName} · ${parcel.recipientPhone}` },
    ...(parcel.alternativePhone
      ? [{ icon: Phone, label: "Alt. Phone", value: parcel.alternativePhone }]
      : []),
    ...(parcel.recipientEmail
      ? [{ icon: User, label: "Email", value: parcel.recipientEmail }]
      : []),
    {
      icon: MapPin,
      label: "Address",
      value: `${parcel.recipientAddress}${parcel.upazila ? ", " + parcel.upazila : ""}, ${parcel.district}`,
    },
  ];
  const detailRows = [
    { icon: Weight, label: "Weight", value: `${parcel.weight} kg` },
    {
      icon: Package,
      label: "Delivery",
      value: `${parcel.deliveryMethod === "point" ? "Point" : "Home"} · ${parcel.zone}`,
    },
    { icon: Wallet, label: "COD", value: formatBDT(parcel.codAmount) },
    ...(parcel.invoiceNumber
      ? [{ icon: Package, label: "Invoice", value: parcel.invoiceNumber }]
      : []),
    ...(parcel.isExchange
      ? [{ icon: Package, label: "Exchange", value: "Yes" }]
      : []),
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/merchant/parcels"
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to parcels
        </Link>
        <div className="flex gap-2">
          <Link href={`/track/${parcel.trackingId}`} target="_blank">
            <Button variant="outline">
              <MapPinned className="h-4 w-4" /> Live Tracking
            </Button>
          </Link>
          <Link href={`/print/label/${parcel.id}`} target="_blank">
            <Button variant="outline">
              <Printer className="h-4 w-4" /> Print Label
            </Button>
          </Link>
          {parcel.status === "pending" && (
            <Button variant="danger" onClick={() => setConfirmCancel(true)}>
              <XCircle className="h-4 w-4" /> Cancel Parcel
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          {/* Header with QR placeholder */}
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-brown-500">{parcel.trackingId}</p>
                <div className="mt-1 flex items-center gap-2">
                  <StatusBadge kind="parcel" status={parcel.status} />
                  <span className="text-xs text-brown-500">
                    Booked {formatDateTime(parcel.createdAt)}
                  </span>
                </div>
              </div>
              <div className="rounded-lg border border-brown-100 bg-white p-2">
                <Barcode value={parcel.trackingId} height={44} moduleWidth={1.3} />
              </div>
            </div>
          </Card>

          {/* Recipient */}
          <Card title="Recipient">
            <dl className="space-y-3">
              {recipientRows.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.label} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 text-brown-400" />
                    <div>
                      <dt className="text-xs text-brown-500">{r.label}</dt>
                      <dd className="text-sm text-brown-700">{r.value}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
            <RecipientRisk
              phone={parcel.recipientPhone}
              excludeParcelId={parcel.id}
              className="mt-4"
            />
          </Card>

          {/* Parcel details + charges */}
          <Card title="Parcel Details">
            <dl className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              {detailRows.map((r) => {
                const Icon = r.icon;
                return (
                  <div key={r.label} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 text-brown-400" />
                    <div>
                      <dt className="text-xs text-brown-500">{r.label}</dt>
                      <dd className="text-sm capitalize text-brown-700">{r.value}</dd>
                    </div>
                  </div>
                );
              })}
            </dl>
            <div className="mt-4 grid grid-cols-3 gap-3 border-t border-brown-100 pt-4 text-center">
              <div>
                <p className="text-xs text-brown-500">Delivery</p>
                <p className="text-sm font-semibold text-brown-700">{formatBDT(parcel.deliveryCharge)}</p>
              </div>
              <div>
                <p className="text-xs text-brown-500">COD Charge</p>
                <p className="text-sm font-semibold text-brown-700">{formatBDT(parcel.codCharge)}</p>
              </div>
              <div>
                <p className="text-xs text-brown-500">Total</p>
                <p className="text-sm font-semibold text-primary">{formatBDT(parcel.totalCharge)}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Delivery man + timeline */}
        <div className="space-y-4">
          {assignedDm && (
            <Card title="Delivery Man">
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
                  {assignedDm.name.charAt(0)}
                </span>
                <div>
                  <p className="font-medium text-brown-800">{assignedDm.name}</p>
                  <a
                    href={`tel:${assignedDm.phone}`}
                    className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                  >
                    <Phone className="h-3.5 w-3.5" /> {assignedDm.phone}
                  </a>
                </div>
              </div>
            </Card>
          )}

          {!assignedDm && (
            <Card title="Delivery Man">
              <p className="flex items-center gap-2 text-sm text-brown-500">
                <Bike className="h-4 w-4" />
                {parcel.status === "delivered" || parcel.status === "returned"
                  ? "Delivery completed."
                  : "The delivery rider will appear here once your parcel reaches the delivery hub."}
              </p>
            </Card>
          )}

          <Card title="Tracking History">
            <Timeline events={merchantHistory} />
          </Card>
        </div>
      </div>

      <Modal
        open={confirmCancel}
        onClose={() => setConfirmCancel(false)}
        title="Cancel parcel?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmCancel(false)}>
              Keep it
            </Button>
            <Button variant="danger" onClick={doCancel}>
              Yes, cancel
            </Button>
          </>
        }
      >
        <p className="text-sm text-brown-600">
          Cancel{" "}
          <span className="font-mono text-brown-800">{parcel.trackingId}</span>?
          This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
