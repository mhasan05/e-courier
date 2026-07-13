"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Package,
  User,
  Weight,
  Wallet,
  MapPin,
  Bike,
  Phone,
  MapPinned,
  Building2,
  Send,
  Check,
  X,
  KeyRound,
  Printer,
} from "lucide-react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Timeline from "@/components/ui/Timeline";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import PanelLoading from "@/components/layout/PanelLoading";
import RecipientRisk from "@/components/parcels/RecipientRisk";
import { useToast } from "@/components/ui/Toast";
import { useHydrated } from "@/hooks/useHydrated";
import {
  useParcels,
  useParcelsReady,
  setParcelStatus,
  addParcelRemark,
  assignDeliveryMan,
  dispatchParcel,
  acceptParcel,
  rejectParcel,
  collectedCodOf,
} from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { parcelInBranch } from "@/hooks/useBranchScope";
import { nextHopBranchId } from "@/lib/hubs";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDateTime, deliveryManCode } from "@/lib/utils";
import { deliveryOtp } from "@/lib/otp";
import type { ParcelStatus } from "@/types";

const STATUS_OPTIONS = (Object.keys(PARCEL_STATUS_META) as ParcelStatus[]).map(
  (s) => ({ value: s, label: PARCEL_STATUS_META[s].label }),
);

export interface ParcelDetailViewProps {
  parcelId: number;
  backHref: string;
  actor?: string; // recorded on status changes ("Admin" | branch code)
  /** When set, the parcel must belong to this hub or it 404s (branch scope). */
  scopeBranchId?: number | null;
}

// Full parcel detail + operations (status, remarks, delivery-man assignment).
// Shared by the HQ admin panel and the branch panel.
export default function ParcelDetailView({
  parcelId,
  backHref,
  actor = "Admin",
  scopeBranchId,
}: ParcelDetailViewProps) {
  const toast = useToast();
  const hydrated = useHydrated();
  const ready = useParcelsReady();
  const all = useParcels();
  const people = useDeliveryMen();
  useBranches();
  const parcel = all.find((p) => p.id === parcelId);

  const [newStatus, setNewStatus] = useState<ParcelStatus | "">(
    parcel ? parcel.status : "",
  );
  const [remark, setRemark] = useState("");
  const [pickedDm, setPickedDm] = useState("");

  // Wait for hydration AND the initial API fetch to settle before deciding the
  // parcel is missing — otherwise a valid parcel would 404 while the store is
  // still loading (localStorage in mock mode, the API in live mode).
  if (!hydrated || !ready) return <PanelLoading />;
  if (!parcel) notFound();
  // Branch scope: a manager can open parcels their hub owns, holds, is the
  // destination for, or that are inbound to it (chain-of-custody visibility).
  if (scopeBranchId != null && !parcelInBranch(parcel, scopeBranchId)) {
    notFound();
  }

  const assignedDm = people.find((d) => d.id === parcel.deliveryManId);

  const updateStatus = () => {
    if (!newStatus || newStatus === parcel.status) return;
    setParcelStatus(parcel.id, newStatus, remark.trim() || undefined, actor);
    toast.success(`Status updated to ${PARCEL_STATUS_META[newStatus].label}`);
    setRemark("");
  };

  const addRemark = () => {
    if (!remark.trim()) return;
    addParcelRemark(parcel.id, remark.trim(), actor);
    toast.success("Remark added");
    setRemark("");
  };

  const assign = () => {
    if (!pickedDm) return;
    const dm = people.find((d) => d.id === Number(pickedDm));
    if (!dm) return;
    assignDeliveryMan(parcel.id, dm.id, dm.name, actor);
    toast.success(`Assigned to ${dm.name}`);
    setPickedDm("");
  };

  const infoRows = [
    { icon: User, label: "Recipient", value: `${parcel.recipientName} · ${parcel.recipientPhone}` },
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
    { icon: Weight, label: "Weight", value: `${parcel.weight} kg` },
    {
      icon: Package,
      label: "Delivery",
      value: `${parcel.deliveryMethod === "point" ? "Point" : "Home"} · ${parcel.zone}`,
    },
    {
      icon: Wallet,
      label: "COD Amount",
      value:
        parcel.status === "partially_delivered"
          ? `${formatBDT(collectedCodOf(parcel))} collected of ${formatBDT(parcel.codAmount)}`
          : formatBDT(parcel.codAmount),
    },
    ...(parcel.invoiceNumber
      ? [{ icon: Package, label: "Invoice", value: parcel.invoiceNumber }]
      : []),
    ...(parcel.isExchange
      ? [{ icon: Package, label: "Exchange", value: "Yes" }]
      : []),
  ];

  const remarks = parcel.history.filter((h) => h.remark);
  const activeDeliveryMen = people.filter(
    (d) =>
      d.status === "active" &&
      (parcel.currentBranchId == null || d.branchId === parcel.currentBranchId),
  );

  const originHub = getBranchById(parcel.originBranchId);
  const destinationHub = getBranchById(parcel.destinationBranchId);
  const currentHub = getBranchById(parcel.currentBranchId);

  // Dispatch to the next hop — allowed when the parcel is at the viewer's hub
  // (HQ can move any) and still has somewhere to go.
  const nextHopId = nextHopBranchId(parcel);
  const nextHub = getBranchById(nextHopId);
  const isHQ = scopeBranchId == null;
  // Only the hub physically holding the parcel (or HQ) dispatches it onward.
  const holdsParcel = isHQ || parcel.currentBranchId === scopeBranchId;
  const canDispatch =
    nextHopId != null &&
    holdsParcel &&
    ["pending", "picked_up", "at_hub"].includes(parcel.status);
  // Accept / Reject: the parcel has been dispatched toward this hub and is
  // awaiting its confirmation of receipt.
  const canReceive =
    parcel.status === "in_transit" && (isHQ || nextHopId === scopeBranchId);

  const dispatch = async () => {
    if (await dispatchParcel(parcel.id, actor)) {
      toast.success(nextHub ? `Dispatched to ${nextHub.name}` : "Dispatched");
      setNewStatus("in_transit");
    } else toast.error("Could not dispatch parcel.");
  };
  const accept = async () => {
    if (await acceptParcel(parcel.id, actor)) {
      toast.success("Parcel received at hub");
      setNewStatus("at_hub");
    } else toast.error("Could not accept parcel.");
  };
  const reject = async () => {
    const reason = window.prompt(
      "Reject this inbound transfer? Enter a reason (missing / damaged / mismatch):",
    );
    if (reason == null) return;
    if (await rejectParcel(parcel.id, reason.trim(), actor))
      toast.success("Transfer rejected");
    else toast.error("Could not reject transfer.");
  };

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={backHref}
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to parcels
        </Link>
        <div className="flex gap-2">
          <Link href={`/print/label/${parcel.id}`} target="_blank">
            <Button variant="outline" size="sm">
              <Printer className="h-4 w-4" /> Print Label
            </Button>
          </Link>
          <Link href={`/track/${parcel.trackingId}`} target="_blank">
            <Button variant="outline" size="sm">
              <MapPinned className="h-4 w-4" /> Live Tracking
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="font-mono text-sm text-brown-500">{parcel.trackingId}</p>
                <p className="text-xs text-brown-500">
                  Booked {formatDateTime(parcel.createdAt)} · {parcel.merchantName}
                </p>
              </div>
              <StatusBadge kind="parcel" status={parcel.status} />
            </div>

            <dl className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              {infoRows.map((row) => {
                const Icon = row.icon;
                return (
                  <div key={row.label} className="flex items-start gap-2">
                    <Icon className="mt-0.5 h-4 w-4 text-brown-400" />
                    <div>
                      <dt className="text-xs text-brown-500">{row.label}</dt>
                      <dd className="text-sm capitalize text-brown-700">{row.value}</dd>
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

            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-brown-100 pt-4 text-sm">
              <Building2 className="h-4 w-4 text-brown-400" />
              <span className="font-medium text-brown-700">{originHub?.code ?? "—"}</span>
              <span className="text-brown-400">→</span>
              <span className="font-medium text-brown-700">{destinationHub?.code ?? "—"}</span>
              {currentHub && (
                <span className="ml-2 rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
                  Now at {currentHub.code}
                </span>
              )}
              {originHub &&
                destinationHub &&
                originHub.id === destinationHub.id && (
                  <span className="rounded-full bg-brown-100 px-2 py-0.5 text-xs text-brown-500">
                    Local
                  </span>
                )}
              {canReceive && (
                <div className="ml-auto flex gap-2">
                  <Button size="sm" onClick={accept}>
                    <Check className="h-3.5 w-3.5" /> Accept
                  </Button>
                  <Button size="sm" variant="danger" onClick={reject}>
                    <X className="h-3.5 w-3.5" /> Reject
                  </Button>
                </div>
              )}
              {canDispatch && nextHub && (
                <Button size="sm" className="ml-auto" onClick={dispatch}>
                  <Send className="h-3.5 w-3.5" /> Dispatch to {nextHub.code}
                </Button>
              )}
            </div>

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

          <Card title="Update Status">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
              <Select
                label="New status"
                value={newStatus || parcel.status}
                onChange={(e) => setNewStatus(e.target.value as ParcelStatus)}
                options={STATUS_OPTIONS}
                className="sm:w-52"
              />
              <input
                type="text"
                value={remark}
                onChange={(e) => setRemark(e.target.value)}
                placeholder="Optional remark"
                className="h-10 flex-1 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 placeholder:text-brown-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
              />
              <div className="flex gap-2">
                <Button
                  onClick={updateStatus}
                  disabled={!newStatus || newStatus === parcel.status}
                >
                  Update
                </Button>
                <Button variant="outline" onClick={addRemark} disabled={!remark.trim()}>
                  Add Remark
                </Button>
              </div>
            </div>
          </Card>

          <Card title={`Internal Remarks (${remarks.length})`}>
            {remarks.length === 0 ? (
              <p className="text-sm text-brown-500">No remarks yet.</p>
            ) : (
              <ul className="space-y-3">
                {[...remarks].reverse().map((r, i) => (
                  <li key={i} className="rounded-lg bg-canvas px-3 py-2">
                    <p className="text-sm text-brown-700">{r.remark}</p>
                    <p className="mt-0.5 text-xs text-brown-500">
                      {r.changedBy ? `${r.changedBy} · ` : ""}
                      {formatDateTime(r.timestamp)}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Delivery Man">
            {assignedDm ? (
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <span className="flex h-11 w-11 items-center justify-center rounded-full bg-primary text-base font-semibold text-white">
                    {assignedDm.name.charAt(0)}
                  </span>
                  <div>
                    <p className="font-medium text-brown-800">{assignedDm.name}</p>
                    <p className="font-mono text-xs text-brown-500">
                      {deliveryManCode(assignedDm.id)}
                    </p>
                  </div>
                </div>
                <a
                  href={`tel:${assignedDm.phone}`}
                  className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline"
                >
                  <Phone className="h-4 w-4" /> {assignedDm.phone}
                </a>
              </div>
            ) : (
              <p className="mb-3 flex items-center gap-2 text-sm text-brown-500">
                <Bike className="h-4 w-4" /> No delivery man assigned yet.
              </p>
            )}

            <div className="mt-4 flex flex-col gap-2 border-t border-brown-100 pt-4">
              <Select
                value={pickedDm}
                onChange={(e) => setPickedDm(e.target.value)}
                placeholder={
                  activeDeliveryMen.length === 0
                    ? "No riders at the current hub"
                    : assignedDm
                      ? "Reassign to…"
                      : "Select delivery man…"
                }
                options={activeDeliveryMen.map((d) => ({
                  value: String(d.id),
                  label: `${d.name} (${d.phone})`,
                }))}
              />
              <Button onClick={assign} disabled={!pickedDm}>
                {assignedDm ? "Reassign" : "Assign"}
              </Button>
            </div>
          </Card>

          {!["delivered", "returned", "cancelled"].includes(parcel.status) && (
            <Card title="Delivery OTP">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                  <KeyRound className="h-5 w-5" />
                </span>
                <div>
                  <p className="font-mono text-2xl font-semibold tracking-tight tracking-widest text-brown-800">
                    {deliveryOtp(parcel.trackingId)}
                  </p>
                  <p className="text-xs text-brown-500">
                    Share with the recipient to confirm delivery.
                  </p>
                </div>
              </div>
            </Card>
          )}

          <Card title="Status Timeline">
            <Timeline events={parcel.history} />
          </Card>
        </div>
      </div>
    </div>
  );
}
