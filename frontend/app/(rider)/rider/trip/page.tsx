"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  Route,
  Phone,
  MapPin,
  PackageCheck,
  CheckCircle2,
  XCircle,
  Store,
  Banknote,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  getActiveTrip,
  openTrip,
  tripDeliver,
  tripFail,
  tripPickup,
  tripClose,
  type ActiveTrip,
  type TripItem,
  type CloseSummary,
} from "@/lib/api/trips";
import { formatBDT } from "@/lib/utils";

const FAIL_REASONS = [
  "Customer unavailable",
  "Customer refused",
  "Wrong address",
  "Phone off / unreachable",
  "Reschedule requested",
];

const OUTCOME_META: Record<TripItem["outcome"], { label: string; classes: string }> = {
  pending: { label: "Pending", classes: "bg-warning-100 text-warning-700" },
  delivered: { label: "Delivered", classes: "bg-success-100 text-success-700" },
  partial: { label: "Partial", classes: "bg-teal-100 text-teal-700" },
  failed: { label: "Failed", classes: "bg-danger-100 text-danger-700" },
  picked_up: { label: "Picked up", classes: "bg-info-100 text-info-700" },
};

export default function RiderTripPage() {
  const toast = useToast();
  const [data, setData] = useState<ActiveTrip | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);

  // modals
  const [deliverItem, setDeliverItem] = useState<TripItem | null>(null);
  const [otp, setOtp] = useState("");
  const [partial, setPartial] = useState("");
  const [failItem, setFailItem] = useState<TripItem | null>(null);
  const [reason, setReason] = useState(FAIL_REASONS[0]);
  const [closeOpen, setCloseOpen] = useState(false);
  const [cash, setCash] = useState("");
  const [summary, setSummary] = useState<CloseSummary | null>(null);

  const load = useCallback(() => {
    getActiveTrip()
      .then(setData)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const trip = data?.trip ?? null;
  const deliveries = trip?.items.filter((i) => i.direction === "delivery") ?? [];
  const pickups = trip?.items.filter((i) => i.direction === "pickup") ?? [];
  const dueSoFar = deliveries
    .filter((i) => i.outcome === "delivered" || i.outcome === "partial")
    .reduce((s, i) => s + i.collectedCod, 0);
  const allDeliveriesDone = deliveries.every((i) => i.outcome !== "pending");

  const start = async () => {
    setBusy(true);
    try {
      await openTrip();
      toast.success("Trip started");
      load();
    } catch {
      toast.error("Could not start trip.");
    } finally {
      setBusy(false);
    }
  };

  const doDeliver = async () => {
    if (!trip || !deliverItem) return;
    setBusy(true);
    try {
      const amt = partial.trim() ? Number(partial) : undefined;
      await tripDeliver(trip.id, deliverItem.parcelId, otp.trim(), amt);
      toast.success("Delivered");
      setDeliverItem(null); setOtp(""); setPartial("");
      load();
    } catch {
      toast.error("Incorrect OTP or invalid amount.");
    } finally {
      setBusy(false);
    }
  };

  const doFail = async () => {
    if (!trip || !failItem) return;
    setBusy(true);
    try {
      await tripFail(trip.id, failItem.parcelId, reason);
      toast.success("Marked failed");
      setFailItem(null);
      load();
    } catch {
      toast.error("Could not update.");
    } finally {
      setBusy(false);
    }
  };

  const doPickup = async (parcelId: number) => {
    if (!trip) return;
    setBusy(true);
    try {
      await tripPickup(trip.id, parcelId);
      toast.success("Picked up");
      load();
    } catch {
      toast.error("Could not pick up.");
    } finally {
      setBusy(false);
    }
  };

  const doClose = async () => {
    if (!trip) return;
    setBusy(true);
    try {
      const res = await tripClose(trip.id, Number(cash || 0));
      setSummary(res.summary);
      setCloseOpen(false);
      setCash("");
      load();
    } catch {
      toast.error("Could not close trip.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-brown-500">Loading…</p>;

  // ── No active trip: start screen ──
  if (!trip) {
    return (
      <div className="space-y-4">
        <Card>
          <div className="flex flex-col items-center py-6 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
              <Route className="h-7 w-7" />
            </span>
            <h2 className="mt-3 text-base font-semibold text-brown-800">Start a delivery trip</h2>
            <p className="mt-1 text-sm text-brown-500">
              {data?.readyForDelivery
                ? `${data.readyForDelivery} parcel(s) at your hub are ready for delivery.`
                : "No parcels are ready for delivery right now."}
            </p>
            <Button className="mt-4" size="lg" onClick={start} disabled={busy}>
              <Route className="h-5 w-5" /> Start Trip
            </Button>
            <Link href="/rider/parcels" className="mt-3 text-xs text-primary hover:underline">
              View all my parcels
            </Link>
          </div>
        </Card>

        {summary && <SummaryCard summary={summary} onDismiss={() => setSummary(null)} />}
      </div>
    );
  }

  // ── Active trip: runsheet ──
  return (
    <div className="space-y-4">
      <Card>
        <div className="flex items-center justify-between">
          <div>
            <p className="font-mono text-xs text-brown-500">{trip.tripId}</p>
            <p className="text-sm font-semibold text-brown-800">Active trip</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-brown-500">Collected so far</p>
            <p className="text-base font-semibold text-primary">{formatBDT(dueSoFar)}</p>
          </div>
        </div>
      </Card>

      {/* Deliveries */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <MapPin className="h-4 w-4 text-primary" /> Deliveries — to customers ({deliveries.length})
          </span>
        }
        bodyClassName="p-0"
      >
        {deliveries.length === 0 ? (
          <p className="p-4 text-sm text-brown-400">No deliveries on this trip.</p>
        ) : (
          <div className="divide-y divide-brown-100">
            {deliveries.map((i) => (
              <div key={i.parcelId} className="p-3">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-mono text-[11px] text-brown-500">{i.trackingId}</p>
                    <p className="truncate text-sm font-medium text-brown-800">{i.recipientName}</p>
                    <p className="flex items-start gap-1 truncate text-xs text-brown-500">
                      <MapPin className="mt-0.5 h-3 w-3 shrink-0" />
                      {i.recipientAddress}, {i.upazila || i.district}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-1">
                    <Badge className={OUTCOME_META[i.outcome].classes}>{OUTCOME_META[i.outcome].label}</Badge>
                    <span className="text-xs font-semibold text-brown-700">{formatBDT(i.codAmount)}</span>
                  </div>
                </div>
                {i.outcome === "pending" ? (
                  <div className="mt-2 flex gap-2">
                    <a href={`tel:${i.recipientPhone}`} className="flex items-center justify-center rounded-lg bg-primary-50 px-3 py-1.5 text-xs font-medium text-primary-700">
                      <Phone className="h-3.5 w-3.5" />
                    </a>
                    <Button size="sm" className="flex-1 justify-center" onClick={() => { setDeliverItem(i); setOtp(""); setPartial(""); }}>
                      <CheckCircle2 className="h-4 w-4" /> Deliver
                    </Button>
                    <Button size="sm" variant="danger" className="flex-1 justify-center" onClick={() => { setFailItem(i); setReason(FAIL_REASONS[0]); }}>
                      <XCircle className="h-4 w-4" /> Fail
                    </Button>
                  </div>
                ) : i.outcome === "failed" ? (
                  <p className="mt-1 text-xs text-danger-600">Failed: {i.failureReason}</p>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Pickups */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Store className="h-4 w-4 text-warning-600" /> Pickups — from merchants ({pickups.length})
          </span>
        }
        bodyClassName="p-0"
      >
        {data && data.availablePickups.length > 0 && (
          <div className="border-b border-brown-100 p-3">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-brown-400">
              Available to pick up
            </p>
            <div className="space-y-2">
              {data.availablePickups.map((p) => (
                <div key={p.parcelId} className="flex items-center justify-between rounded-lg border border-brown-100 p-2.5">
                  <div className="min-w-0">
                    <p className="flex items-center gap-1 truncate text-sm font-medium text-brown-800">
                      <Store className="h-3.5 w-3.5 text-brown-400" /> {p.merchantName}
                    </p>
                    <p className="truncate text-xs text-brown-500">{p.pickupAddress}</p>
                  </div>
                  <Button size="sm" onClick={() => doPickup(p.parcelId)} disabled={busy}>
                    <PackageCheck className="h-4 w-4" /> Pick up
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}
        {pickups.length === 0 ? (
          <p className="p-4 text-sm text-brown-400">No pickups collected yet.</p>
        ) : (
          <div className="divide-y divide-brown-100">
            {pickups.map((i) => (
              <div key={i.parcelId} className="flex items-center justify-between p-3">
                <div>
                  <p className="font-mono text-[11px] text-brown-500">{i.trackingId}</p>
                  <p className="text-sm font-medium text-brown-800">{i.recipientName}</p>
                </div>
                <Badge className={OUTCOME_META[i.outcome].classes}>{OUTCOME_META[i.outcome].label}</Badge>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Close */}
      <div className="sticky bottom-0 -mx-4 border-t border-brown-100 bg-white/95 p-3 backdrop-blur">
        <Button
          size="lg"
          className="w-full"
          onClick={() => { setCash(String(dueSoFar)); setCloseOpen(true); }}
        >
          <Banknote className="h-5 w-5" /> Close trip &amp; hand in cash
        </Button>
        {!allDeliveriesDone && (
          <p className="mt-1.5 text-center text-xs text-brown-400">
            You still have pending deliveries — closing will hold them for reattempt.
          </p>
        )}
      </div>

      {/* Deliver modal */}
      <Modal
        open={deliverItem != null}
        onClose={() => setDeliverItem(null)}
        title="Confirm delivery"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeliverItem(null)}>Cancel</Button>
            <Button onClick={doDeliver} disabled={busy}>Confirm</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-brown-600">
            Ask <span className="font-medium">{deliverItem?.recipientName}</span> for the 4-digit OTP.
            COD to collect: <span className="font-semibold">{formatBDT(deliverItem?.codAmount ?? 0)}</span>.
          </p>
          <Input label="Delivery OTP" value={otp} onChange={(e) => setOtp(e.target.value)} placeholder="4-digit code" />
          {(deliverItem?.codAmount ?? 0) > 0 && (
            <Input
              label="Partial COD (optional)"
              type="number"
              value={partial}
              onChange={(e) => setPartial(e.target.value)}
              placeholder={`Leave blank for full ${formatBDT(deliverItem?.codAmount ?? 0)}`}
            />
          )}
        </div>
      </Modal>

      {/* Fail modal */}
      <Modal
        open={failItem != null}
        onClose={() => setFailItem(null)}
        title="Mark delivery failed"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setFailItem(null)}>Cancel</Button>
            <Button variant="danger" onClick={doFail} disabled={busy}>Mark failed</Button>
          </>
        }
      >
        <div className="space-y-2">
          <p className="text-sm text-brown-600">Why did the delivery fail?</p>
          {FAIL_REASONS.map((r) => (
            <label key={r} className="flex items-center gap-2 text-sm text-brown-700">
              <input type="radio" name="reason" checked={reason === r} onChange={() => setReason(r)} className="accent-primary" />
              {r}
            </label>
          ))}
        </div>
      </Modal>

      {/* Close modal */}
      <Modal
        open={closeOpen}
        onClose={() => setCloseOpen(false)}
        title="Close trip"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCloseOpen(false)}>Cancel</Button>
            <Button onClick={doClose} disabled={busy}>Confirm close</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-canvas p-3 text-sm">
            <div className="flex justify-between"><span className="text-brown-500">COD collected (due)</span><span className="font-semibold text-brown-800">{formatBDT(dueSoFar)}</span></div>
          </div>
          <Input
            label="Cash you are handing in (৳)"
            type="number"
            value={cash}
            onChange={(e) => setCash(e.target.value)}
          />
          {Number(cash || 0) !== dueSoFar && (
            <p className="text-xs text-warning-700">
              Doesn&apos;t match the ৳{dueSoFar} due — the shortfall/excess will be recorded against you.
            </p>
          )}
        </div>
      </Modal>

      {summary && <SummaryCard summary={summary} onDismiss={() => setSummary(null)} />}
    </div>
  );
}

function SummaryCard({
  summary,
  onDismiss,
}: {
  summary: CloseSummary;
  onDismiss: () => void;
}) {
  return (
    <Modal open onClose={onDismiss} title="Trip closed" size="sm" footer={<Button onClick={onDismiss}>Done</Button>}>
      <div className="space-y-2 text-sm">
        <div className="flex justify-between"><span className="text-brown-500">COD due</span><span className="font-medium">{formatBDT(summary.due)}</span></div>
        <div className="flex justify-between"><span className="text-brown-500">Cash handed in</span><span className="font-medium">{formatBDT(summary.collected)}</span></div>
        <div className="flex justify-between border-t border-brown-100 pt-2">
          <span className="text-brown-500">{summary.short > 0 ? "Shortfall (you owe)" : summary.short < 0 ? "Excess" : "Balanced"}</span>
          <span className={summary.short === 0 ? "font-semibold text-success-700" : "font-semibold text-danger-600"}>
            {formatBDT(Math.abs(summary.short))}
          </span>
        </div>
        {summary.reconciled ? (
          <p className="text-xs text-success-700">Reconciled — cash matches the COD collected.</p>
        ) : (
          <p className="text-xs text-warning-700">Recorded a discrepancy — your hub will follow up.</p>
        )}
      </div>
    </Modal>
  );
}
