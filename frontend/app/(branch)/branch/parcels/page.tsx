"use client";

import { useCallback, useMemo, useState, type MouseEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Tabs from "@/components/ui/Tabs";
import SearchInput from "@/components/ui/SearchInput";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Textarea from "@/components/ui/Textarea";
import { Send, Bike, Check, X, PackageCheck, Undo2 } from "lucide-react";
import {
  useParcels,
  dispatchParcel,
  acceptParcel,
  rejectParcel,
  returnParcel,
  assignDeliveryMan,
} from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import {
  useBranchScope,
  parcelInBranch,
  parcelIncomingToBranch,
  parcelAtBranch,
} from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";
import { getBranchById } from "@/lib/branch-store";
import { nextHopBranchId } from "@/lib/hubs";
import { useToast } from "@/components/ui/Toast";
import { formatBDT, formatDate, cn } from "@/lib/utils";
import type { Parcel } from "@/types";

const PAGE_SIZE = 10;

// Plain-language explanation of what each tab means + the action to take.
const TAB_HINTS: Record<string, string> = {
  incoming:
    "On their way to your hub. Tap Accept to receive them into the hub (or Reject if something's wrong).",
  athub:
    "Resting at your hub. If this is the delivery hub → Assign a rider. Otherwise bag them and dispatch onward (see the Bags page).",
  outbound:
    "You've dispatched these — waiting for the next hub to accept them.",
  all: "Every parcel involving your hub.",
  delivered: "Completed deliveries handled by your hub.",
  returned: "Parcels being returned to the sender (RTO).",
};

export default function BranchParcelsPage() {
  const router = useRouter();
  const { branchId, branch } = useBranchScope();
  const { name } = useAuth();
  const all = useParcels();
  const people = useDeliveryMen();
  const toast = useToast();
  const [tab, setTab] = useState("incoming");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pickedDm, setPickedDm] = useState("");
  const [rejecting, setRejecting] = useState<Parcel | null>(null);
  const [rejectReason, setRejectReason] = useState("");
  const [returning, setReturning] = useState<Parcel | null>(null);
  const [returnReason, setReturnReason] = useState("");

  // Who is taking the action — recorded on every custody event for transparency.
  const actor = [name, branch?.name].filter(Boolean).join(" · ") || "Branch";

  // Active riders of this hub — the only ones this manager can assign.
  const hubRiders = people.filter(
    (d) => d.branchId === branchId && d.status === "active",
  );

  const inScope = useMemo(
    () => (branchId == null ? [] : all.filter((p) => parcelInBranch(p, branchId))),
    [all, branchId],
  );

  // Custody-relative predicates for this hub (memoized on branchId so the memos
  // below have stable, lint-clean dependencies).
  const isIncoming = useCallback(
    (p: Parcel) => branchId != null && parcelIncomingToBranch(p, branchId),
    [branchId],
  );
  const isAtHub = useCallback(
    (p: Parcel) => branchId != null && parcelAtBranch(p, branchId),
    [branchId],
  );
  const isOutbound = useCallback(
    (p: Parcel) => p.status === "in_transit" && p.currentBranchId === branchId,
    [branchId],
  );
  const isAtDestination = (p: Parcel) =>
    isAtHub(p) && p.currentBranchId === p.destinationBranchId;

  const counts = useMemo(
    () => ({
      incoming: inScope.filter(isIncoming).length,
      athub: inScope.filter(isAtHub).length,
      outbound: inScope.filter(isOutbound).length,
    }),
    [inScope, isIncoming, isAtHub, isOutbound],
  );

  const TABS = [
    { label: "Incoming", value: "incoming", count: counts.incoming },
    { label: "At Hub", value: "athub", count: counts.athub },
    { label: "Outbound", value: "outbound", count: counts.outbound },
    { label: "All", value: "all" },
    { label: "Delivered", value: "delivered" },
    { label: "Returned", value: "returned" },
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return inScope.filter((p) => {
      const tabOk =
        tab === "all"
          ? true
          : tab === "incoming"
            ? isIncoming(p)
            : tab === "athub"
              ? isAtHub(p)
              : tab === "outbound"
                ? isOutbound(p)
                : tab === "delivered"
                  ? p.status === "delivered"
                  : tab === "returned"
                    ? ["returned", "return_in_transit"].includes(p.status)
                    : true;
      if (!tabOk) return false;
      if (
        q &&
        !p.trackingId.toLowerCase().includes(q) &&
        !p.recipientName.toLowerCase().includes(q)
      )
        return false;
      return true;
    });
  }, [inScope, tab, search, isIncoming, isAtHub, isOutbound]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

  // Only at-destination parcels are selectable for delivery-man assignment.
  const assignable = pageRows.filter(isAtDestination);
  const allOnPageSelected =
    assignable.length > 0 && assignable.every((p) => selected.has(p.id));

  const toggleRow = (id: number) =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const toggleAllOnPage = () =>
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) assignable.forEach((p) => next.delete(p.id));
      else assignable.forEach((p) => next.add(p.id));
      return next;
    });

  const assignBulk = () => {
    if (!pickedDm || selected.size === 0) return;
    const dm = hubRiders.find((d) => d.id === Number(pickedDm));
    if (!dm) return;
    selected.forEach((id) => assignDeliveryMan(id, dm.id, dm.name, actor));
    toast.success(`Assigned ${selected.size} parcel(s) to ${dm.name}`);
    setSelected(new Set());
    setPickedDm("");
  };

  const hubBadge = (id?: number) => getBranchById(id)?.code ?? "—";
  const lastActor = (p: Parcel) =>
    p.history[p.history.length - 1]?.changedBy ?? "—";

  const accept = async (p: Parcel) => {
    if (await acceptParcel(p.id, actor)) toast.success(`Accepted ${p.trackingId}`);
    else toast.error("Could not accept parcel.");
  };
  const dispatch = async (p: Parcel) => {
    const next = getBranchById(nextHopBranchId(p));
    if (await dispatchParcel(p.id, actor))
      toast.success(`Dispatched${next ? ` to ${next.name}` : ""}`);
    else toast.error("Could not dispatch parcel.");
  };
  const confirmReject = async () => {
    if (!rejecting) return;
    const ok = await rejectParcel(rejecting.id, rejectReason.trim(), actor);
    if (ok) toast.success(`Transfer rejected — ${rejecting.trackingId}`);
    else toast.error("Could not reject transfer.");
    setRejecting(null);
    setRejectReason("");
  };
  const confirmReturn = async () => {
    if (!returning) return;
    const ok = await returnParcel(returning.id, returnReason.trim(), actor);
    if (ok) toast.success(`Return started — ${returning.trackingId}`);
    else toast.error("Could not start return.");
    setReturning(null);
    setReturnReason("");
  };

  const columns: Column<Parcel>[] = [
    {
      key: "select",
      header: (
        <input
          type="checkbox"
          checked={allOnPageSelected}
          onChange={toggleAllOnPage}
          className="h-4 w-4 accent-primary"
          aria-label="Select all assignable on page"
          disabled={assignable.length === 0}
        />
      ),
      render: (p) =>
        isAtDestination(p) ? (
          <input
            type="checkbox"
            checked={selected.has(p.id)}
            onChange={() => toggleRow(p.id)}
            onClick={(e) => e.stopPropagation()}
            className="h-4 w-4 accent-primary"
            aria-label={`Select ${p.trackingId}`}
          />
        ) : null,
    },
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => (
        <Link
          href={`/branch/parcels/${p.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {p.trackingId}
        </Link>
      ),
    },
    { key: "recipientName", header: "Recipient" },
    {
      key: "route",
      header: "Route",
      render: (p) => (
        <span className="text-xs text-brown-500">
          {hubBadge(p.originBranchId)} → {hubBadge(p.destinationBranchId)}
        </span>
      ),
    },
    {
      key: "current",
      header: "At",
      render: (p) =>
        p.currentBranchId === branchId ? (
          <Badge className="bg-primary-50 text-primary-700">Here</Badge>
        ) : (
          <span className="text-xs text-brown-500">{hubBadge(p.currentBranchId)}</span>
        ),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    {
      key: "by",
      header: "Last action by",
      render: (p) => <span className="text-xs text-brown-500">{lastActor(p)}</span>,
    },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (p) => {
        // Stop clicks on action controls from bubbling to the row navigation.
        const stop = (e: MouseEvent) => e.stopPropagation();
        if (isIncoming(p)) {
          return (
            <div className="flex justify-end gap-1.5" onClick={stop}>
              <Button size="sm" onClick={() => accept(p)}>
                <Check className="h-3.5 w-3.5" /> Accept
              </Button>
              <Button size="sm" variant="danger" onClick={() => setRejecting(p)}>
                <X className="h-3.5 w-3.5" /> Reject
              </Button>
            </div>
          );
        }
        if (isAtDestination(p)) {
          return (
            <div className="flex justify-end gap-1.5" onClick={stop}>
              <Button size="sm" variant="outline" onClick={() => toggleRow(p.id)}>
                <Bike className="h-3.5 w-3.5" /> Assign
              </Button>
              <Button size="sm" variant="ghost" onClick={() => { setReturning(p); setReturnReason(""); }}>
                <Undo2 className="h-3.5 w-3.5" /> Return
              </Button>
            </div>
          );
        }
        if (isAtHub(p) && nextHopBranchId(p) != null) {
          return (
            <div className="flex justify-end" onClick={stop}>
              <Button size="sm" variant="outline" onClick={() => dispatch(p)}>
                <Send className="h-3.5 w-3.5" /> Dispatch
              </Button>
            </div>
          );
        }
        return null;
      },
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v);
            resetPage();
          }}
          tabs={TABS}
        />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            resetPage();
          }}
          placeholder="Tracking ID / recipient"
          className="w-full sm:w-72"
        />
      </div>

      {/* Plain-language hint for the active tab */}
      <div className="rounded-lg border border-brown-100 bg-canvas px-3 py-2 text-xs text-brown-500">
        {TAB_HINTS[tab] ?? "All parcels involving your hub."}
      </div>

      {/* Bulk assign delivery man (at-destination parcels only) */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="flex items-center gap-1.5 text-sm font-medium text-primary-700">
            <Bike className="h-4 w-4" /> {selected.size} selected for delivery
          </span>
          <Select
            value={pickedDm}
            onChange={(e) => setPickedDm(e.target.value)}
            placeholder={
              hubRiders.length ? "Assign delivery man…" : "No active riders at this hub"
            }
            options={hubRiders.map((d) => ({
              value: String(d.id),
              label: `${d.name} (${d.phone})`,
            }))}
            className="w-60"
          />
          <Button size="sm" onClick={assignBulk} disabled={!pickedDm}>
            <PackageCheck className="h-4 w-4" /> Assign for Delivery
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={pageRows}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/branch/parcels/${p.id}`)}
          emptyMessage={
            tab === "incoming"
              ? "No incoming parcels awaiting acceptance."
              : "No parcels match."
          }
          rowClassName={(p) => cn(selected.has(p.id) && "bg-primary-50/50")}
          className="border-0 shadow-none"
        />
        <div className="px-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      </Card>

      {/* Reject / discrepancy modal */}
      <Modal
        open={rejecting != null}
        onClose={() => setRejecting(null)}
        title="Reject inbound transfer"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRejecting(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={confirmReject}>
              Reject Transfer
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-brown-600">
            Rejecting <span className="font-mono">{rejecting?.trackingId}</span>. Custody
            stays with the sending hub. Recorded against your name (
            <span className="font-medium">{actor}</span>).
          </p>
          <Textarea
            label="Reason"
            rows={3}
            value={rejectReason}
            onChange={(e) => setRejectReason(e.target.value)}
            placeholder="e.g. Parcel missing from the bag / damaged / count mismatch"
          />
        </div>
      </Modal>

      {/* Return to sender (RTO) modal */}
      <Modal
        open={returning != null}
        onClose={() => setReturning(null)}
        title="Return to sender"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReturning(null)}>
              Cancel
            </Button>
            <Button onClick={confirmReturn}>Start Return</Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-brown-600">
            Return <span className="font-mono">{returning?.trackingId}</span> to the
            merchant. It will route back {returning?.district && `from ${returning.district} `}
            through the hub chain to its origin.
            {returning?.reattemptCount ? ` (${returning.reattemptCount} failed attempt(s).)` : ""}
          </p>
          <Textarea
            label="Reason"
            rows={3}
            value={returnReason}
            onChange={(e) => setReturnReason(e.target.value)}
            placeholder="e.g. 3 failed delivery attempts / customer refused"
          />
        </div>
      </Modal>
    </div>
  );
}
