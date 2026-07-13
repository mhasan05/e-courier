"use client";

import { useMemo, useState } from "react";
import { Wallet, CheckCircle2, Send, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useParcels, collectedCodOf } from "@/lib/parcel-store";
import {
  useRiderHandovers,
  cashInHandParcels,
  createRiderHandover,
} from "@/lib/rider-handover-store";
import { useRiderScope } from "@/hooks/useRiderScope";
import { formatBDT, formatDate } from "@/lib/utils";

export default function RiderCashPage() {
  const toast = useToast();
  const { deliveryManId, rider } = useRiderScope();
  const all = useParcels();
  const handovers = useRiderHandovers();
  const [confirmOpen, setConfirmOpen] = useState(false);

  const inHand = useMemo(
    () =>
      deliveryManId == null
        ? []
        : cashInHandParcels(all, handovers, deliveryManId).sort((a, b) =>
            b.createdAt.localeCompare(a.createdAt),
          ),
    [all, handovers, deliveryManId],
  );

  const cashInHand = inHand.reduce((s, p) => s + collectedCodOf(p), 0);

  const myHandovers = useMemo(
    () =>
      deliveryManId == null
        ? []
        : handovers
            .filter((h) => h.riderId === deliveryManId)
            .sort((a, b) => b.remittedAt.localeCompare(a.remittedAt)),
    [handovers, deliveryManId],
  );

  const handOver = async () => {
    if (deliveryManId == null || rider == null) return;
    try {
      const h = await createRiderHandover({
        riderId: deliveryManId,
        riderName: rider.name,
        branchId: rider.branchId ?? 0,
        parcels: inHand,
      });
      setConfirmOpen(false);
      if (h) toast.success(`Handed over ${formatBDT(h.amount)} to hub`);
    } catch {
      setConfirmOpen(false);
      toast.error("Could not hand over cash. Please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="rounded-2xl bg-gradient-to-br from-primary-700 to-primary p-5 text-white shadow-card">
        <p className="text-sm text-primary-100">Cash in Hand</p>
        <p className="mt-1 text-4xl font-semibold tracking-tight">{formatBDT(cashInHand)}</p>
        <p className="mt-1 text-xs text-primary-100">
          From {inHand.length} collected COD parcel(s)
        </p>
      </div>

      <Button
        size="lg"
        className="w-full"
        disabled={cashInHand <= 0}
        onClick={() => setConfirmOpen(true)}
      >
        <Send className="h-5 w-5" /> Hand over to Hub
      </Button>

      <Card title="Collected — Not Yet Handed Over">
        {inHand.length === 0 ? (
          <p className="text-sm text-brown-500">Nothing pending. All cash handed over.</p>
        ) : (
          <div className="space-y-2">
            {inHand.map((p) => (
              <div key={p.id} className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-medium text-brown-700">
                    {p.recipientName}
                    {p.status === "partially_delivered" && (
                      <span className="ml-1.5 rounded bg-warning-100 px-1.5 py-0.5 text-[10px] font-medium text-warning-700">
                        Partial
                      </span>
                    )}
                  </p>
                  <p className="font-mono text-[11px] text-brown-500">
                    {p.trackingId} · {formatDate(p.createdAt)}
                  </p>
                </div>
                <span className="flex items-center gap-1 text-sm font-semibold text-brown-800">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  {formatBDT(collectedCodOf(p))}
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Handover History">
        {myHandovers.length === 0 ? (
          <p className="text-sm text-brown-500">No handovers yet.</p>
        ) : (
          <div className="space-y-2">
            {myHandovers.map((h) => (
              <div key={h.id} className="flex items-center justify-between rounded-lg border border-brown-100 px-3 py-2">
                <div className="min-w-0">
                  <p className="font-mono text-xs text-brown-600">{h.reference}</p>
                  <p className="text-[11px] text-brown-500">
                    {h.parcelCount} parcel(s) · {formatDate(h.remittedAt)}
                  </p>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-sm font-semibold text-brown-800">{formatBDT(h.amount)}</span>
                  {h.status === "received" ? (
                    <span className="inline-flex items-center gap-1 rounded-full bg-primary-50 px-2 py-0.5 text-[10px] font-medium text-primary-700">
                      <CheckCircle2 className="h-3 w-3" /> Received
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 rounded-full bg-warning-50 px-2 py-0.5 text-[10px] font-medium text-warning-700">
                      <Clock className="h-3 w-3" /> Pending
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </Card>

      <p className="flex items-center justify-center gap-1.5 text-center text-xs text-brown-400">
        <Wallet className="h-3.5 w-3.5" /> Your hub confirms receipt of each handover.
      </p>

      <Modal
        open={confirmOpen}
        onClose={() => setConfirmOpen(false)}
        title="Hand over cash to hub"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>Cancel</Button>
            <Button onClick={handOver}>Confirm Handover</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-brown-600">
            Hand over <span className="font-semibold text-brown-800">{formatBDT(cashInHand)}</span>{" "}
            from {inHand.length} parcel(s) to your hub. The hub will confirm receipt.
          </p>
        </div>
      </Modal>
    </div>
  );
}
