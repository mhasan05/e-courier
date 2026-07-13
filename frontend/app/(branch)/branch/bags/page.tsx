"use client";

import { useCallback, useEffect, useState } from "react";
import { PackageOpen, Send, ArrowDownToLine, ArrowRight, Boxes } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useBranchScope } from "@/hooks/useBranchScope";
import {
  listBags,
  baggableGroups,
  buildBag,
  dispatchBag,
  receiveBag,
  type Bag,
  type BaggableGroup,
} from "@/lib/api/bags";
import { formatDateTime } from "@/lib/utils";

const STATUS_META: Record<Bag["status"], { label: string; classes: string }> = {
  open: { label: "Open", classes: "bg-warning-100 text-warning-700" },
  dispatched: { label: "In Transit", classes: "bg-blue-100 text-blue-700" },
  received: { label: "Received", classes: "bg-success-100 text-success-700" },
};

export default function BranchBagsPage() {
  const toast = useToast();
  const { branchId, branch } = useBranchScope();
  const [groups, setGroups] = useState<BaggableGroup[]>([]);
  const [bags, setBags] = useState<Bag[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<number | null>(null);

  const load = useCallback(() => {
    Promise.all([baggableGroups().catch(() => []), listBags().catch(() => [])])
      .then(([g, b]) => {
        setGroups(g);
        setBags(b);
      })
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const create = async (g: BaggableGroup) => {
    setBusy(g.toBranchId);
    try {
      await buildBag(g.toBranchId, g.parcels.map((p) => p.id));
      toast.success(`Bag created for ${g.toBranchName}`);
      load();
    } catch {
      toast.error("Could not create the bag.");
    } finally {
      setBusy(null);
    }
  };

  const doDispatch = async (bag: Bag) => {
    setBusy(bag.id);
    try {
      await dispatchBag(bag.id);
      toast.success(`${bag.bagId} dispatched`);
      load();
    } catch {
      toast.error("Could not dispatch the bag.");
    } finally {
      setBusy(null);
    }
  };

  const doReceive = async (bag: Bag) => {
    setBusy(bag.id);
    try {
      await receiveBag(bag.id);
      toast.success(`${bag.bagId} received — ${bag.parcelCount} parcel(s) at your hub`);
      load();
    } catch {
      toast.error("Could not receive the bag.");
    } finally {
      setBusy(null);
    }
  };

  const outbound = bags.filter((b) => b.fromBranchId === branchId && b.status !== "received");
  const incoming = bags.filter((b) => b.toBranchId === branchId && b.status === "dispatched");
  const history = bags
    .filter((b) => b.status === "received")
    .slice(0, 8);

  if (loading) {
    return <p className="p-6 text-sm text-brown-500">Loading bags…</p>;
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-900">Bags &amp; Line-haul</h1>
        <p className="text-sm text-brown-500">
          Group parcels heading to the same hub into a bag, dispatch it, and
          receive incoming bags at {branch?.name ?? "your hub"}.
        </p>
      </div>

      {/* Incoming bags to receive */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <ArrowDownToLine className="h-4 w-4" /> Incoming bags ({incoming.length})
          </span>
        }
      >
        {incoming.length === 0 ? (
          <p className="text-sm text-brown-400">No bags in transit to your hub.</p>
        ) : (
          <div className="space-y-2">
            {incoming.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-brown-100 p-3">
                <div>
                  <p className="font-mono text-sm font-medium text-brown-800">{b.bagId}</p>
                  <p className="text-xs text-brown-500">
                    From {b.fromBranchName} · {b.parcelCount} parcel(s) · sent{" "}
                    {b.dispatchedAt ? formatDateTime(b.dispatchedAt) : ""}
                  </p>
                </div>
                <Button size="sm" onClick={() => doReceive(b)} disabled={busy === b.id}>
                  <ArrowDownToLine className="h-4 w-4" /> Receive &amp; break
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Ready to bag (build) */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Boxes className="h-4 w-4" /> Ready to bag
          </span>
        }
      >
        {groups.length === 0 ? (
          <p className="text-sm text-brown-400">
            No parcels waiting to move onward. Parcels appear here once they&apos;re
            received at your hub and need to travel to another hub.
          </p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2">
            {groups.map((g) => (
              <div key={g.toBranchId} className="rounded-xl border border-brown-100 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-brown-800">
                  <span className="text-brown-400">To</span>
                  <ArrowRight className="h-4 w-4 text-brown-300" />
                  {g.toBranchName}
                </div>
                <p className="mt-1 text-xs text-brown-500">{g.parcels.length} parcel(s) ready</p>
                <div className="mt-2 max-h-28 space-y-1 overflow-y-auto">
                  {g.parcels.map((p) => (
                    <div key={p.id} className="flex justify-between text-xs text-brown-600">
                      <span className="font-mono">{p.trackingId}</span>
                      <span className="text-brown-400">{p.upazila || p.district}</span>
                    </div>
                  ))}
                </div>
                <Button
                  size="sm"
                  className="mt-3 w-full justify-center"
                  onClick={() => create(g)}
                  disabled={busy === g.toBranchId}
                >
                  <PackageOpen className="h-4 w-4" /> Create bag ({g.parcels.length})
                </Button>
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Outbound bags (open → dispatch, or in transit) */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Send className="h-4 w-4" /> Outbound bags ({outbound.length})
          </span>
        }
      >
        {outbound.length === 0 ? (
          <p className="text-sm text-brown-400">No open or in-transit bags.</p>
        ) : (
          <div className="space-y-2">
            {outbound.map((b) => (
              <div key={b.id} className="flex items-center justify-between rounded-lg border border-brown-100 p-3">
                <div>
                  <p className="flex items-center gap-2 font-mono text-sm font-medium text-brown-800">
                    {b.bagId}
                    <Badge className={STATUS_META[b.status].classes}>{STATUS_META[b.status].label}</Badge>
                  </p>
                  <p className="text-xs text-brown-500">
                    → {b.toBranchName} · {b.parcelCount} parcel(s)
                  </p>
                </div>
                {b.status === "open" ? (
                  <Button size="sm" onClick={() => doDispatch(b)} disabled={busy === b.id}>
                    <Send className="h-4 w-4" /> Dispatch
                  </Button>
                ) : (
                  <span className="text-xs text-brown-400">In transit…</span>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      {/* Recent received */}
      {history.length > 0 && (
        <Card title="Recently received">
          <div className="space-y-1.5">
            {history.map((b) => (
              <div key={b.id} className="flex justify-between text-sm">
                <span className="font-mono text-brown-700">{b.bagId}</span>
                <span className="text-xs text-brown-500">
                  {b.fromBranchName} → {b.toBranchName} · {b.parcelCount} · {b.receivedAt ? formatDateTime(b.receivedAt) : ""}
                </span>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
