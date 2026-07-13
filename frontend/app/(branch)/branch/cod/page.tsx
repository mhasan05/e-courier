"use client";

import { useMemo, useState } from "react";
import { Wallet, Send, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import StatCard from "@/components/ui/StatCard";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import ExportButton from "@/components/ui/ExportButton";
import { useToast } from "@/components/ui/Toast";
import { useParcels, collectedCodOf } from "@/lib/parcel-store";
import {
  useRemittances,
  addRemittance,
  remittedForBranch,
} from "@/lib/remittance-store";
import {
  useRiderHandovers,
  confirmRiderHandover,
} from "@/lib/rider-handover-store";
import { useBranchScope } from "@/hooks/useBranchScope";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel, HubRemittance, RiderHandover } from "@/types";

export default function BranchCodPage() {
  const toast = useToast();
  const { branchId, branch } = useBranchScope();
  const all = useParcels();
  const remittances = useRemittances();
  const riderHandovers = useRiderHandovers();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ amount: "", reference: "", note: "" });

  // The managing hub collects/handles COD for its merchants' delivered parcels
  // (full deliveries + the collected portion of partial deliveries).
  const delivered = useMemo(
    () =>
      branchId == null
        ? []
        : all
            .filter(
              (p) =>
                p.ownerBranchId === branchId &&
                (p.status === "delivered" || p.status === "partially_delivered"),
            )
            .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, branchId],
  );

  const collected = delivered.reduce((s, p) => s + collectedCodOf(p), 0);
  const sent = branchId == null ? 0 : remittedForBranch(remittances, branchId);
  const outstanding = Math.max(0, collected - sent);

  const myRemittances = useMemo(
    () =>
      branchId == null
        ? []
        : remittances
            .filter((r) => r.branchId === branchId)
            .sort((a, b) => b.remittedAt.localeCompare(a.remittedAt)),
    [remittances, branchId],
  );

  const branchHandovers = useMemo(
    () =>
      branchId == null
        ? []
        : riderHandovers
            .filter((h) => h.branchId === branchId)
            .sort((a, b) => b.remittedAt.localeCompare(a.remittedAt)),
    [riderHandovers, branchId],
  );

  const pendingHandoverTotal = branchHandovers
    .filter((h) => h.status === "pending")
    .reduce((s, h) => s + h.amount, 0);

  const confirmHandover = async (h: RiderHandover) => {
    try {
      await confirmRiderHandover(h.id, branch?.code ?? "Hub");
      toast.success(`Confirmed ${formatBDT(h.amount)} from ${h.riderName}`);
    } catch {
      toast.error("Could not confirm the handover.");
    }
  };

  const openRemit = () => {
    if (outstanding <= 0) {
      toast.error("Nothing outstanding to remit");
      return;
    }
    setForm({ amount: String(outstanding), reference: "", note: "" });
    setOpen(true);
  };

  const submit = async () => {
    if (branchId == null) return;
    const amount = Number(form.amount) || 0;
    if (amount <= 0 || amount > outstanding) {
      toast.error("Amount must be between 1 and the outstanding balance");
      return;
    }
    if (!form.reference.trim()) {
      toast.error("A reference is required");
      return;
    }
    try {
      await addRemittance({
        branchId,
        amount,
        parcelCount: delivered.length,
        reference: form.reference.trim(),
        note: form.note.trim() || undefined,
      });
      toast.success(`Remitted ${formatBDT(amount)} to HQ`);
      setOpen(false);
    } catch {
      toast.error("Could not create the remittance.");
    }
  };

  const deliveredColumns: Column<Parcel>[] = [
    { key: "trackingId", header: "Tracking ID", render: (p) => (
      <span className="font-mono text-xs text-brown-600">{p.trackingId}</span>
    ) },
    { key: "merchantName", header: "Merchant" },
    { key: "codAmount", header: "COD", render: (p) =>
      p.status === "partially_delivered" ? (
        <span className="flex items-center gap-1.5">
          {formatBDT(collectedCodOf(p))}
          <Badge className="bg-warning-100 text-warning-700">Partial</Badge>
        </span>
      ) : (
        formatBDT(p.codAmount)
      ) },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  const remitColumns: Column<HubRemittance>[] = [
    { key: "remittedAt", header: "Date", render: (r) => formatDate(r.remittedAt) },
    { key: "amount", header: "Amount", render: (r) => formatBDT(r.amount) },
    { key: "reference", header: "Reference", render: (r) => (
      <span className="font-mono text-xs">{r.reference}</span>
    ) },
    { key: "status", header: "Status", render: (r) =>
      r.status === "received" ? (
        <Badge className="bg-primary-100 text-primary-700">Received by HQ</Badge>
      ) : (
        <Badge className="bg-warning-100 text-warning-700">In transit</Badge>
      ) },
  ];

  const handoverColumns: Column<RiderHandover>[] = [
    { key: "remittedAt", header: "Date", render: (h) => formatDate(h.remittedAt) },
    { key: "riderName", header: "Rider" },
    { key: "reference", header: "Reference", render: (h) => (
      <span className="font-mono text-xs">{h.reference}</span>
    ) },
    { key: "parcelCount", header: "Parcels", render: (h) => h.parcelCount },
    { key: "amount", header: "Amount", render: (h) => formatBDT(h.amount) },
    { key: "status", header: "Status", render: (h) =>
      h.status === "received" ? (
        <Badge className="bg-primary-100 text-primary-700">
          Received{h.confirmedBy ? ` · ${h.confirmedBy}` : ""}
        </Badge>
      ) : (
        <Badge className="bg-warning-100 text-warning-700">Pending</Badge>
      ) },
    { key: "action", header: "", render: (h) =>
      h.status === "pending" ? (
        <Button size="sm" onClick={() => confirmHandover(h)}>
          Confirm Receipt
        </Button>
      ) : null },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
        <StatCard label="COD Collected" value={formatBDT(collected)} icon={Wallet} accent="brown" />
        <StatCard label="Sent to HQ" value={formatBDT(sent)} icon={Send} />
        <StatCard label="Outstanding" value={formatBDT(outstanding)} icon={Clock} accent="amber" />
        <div className="flex items-center justify-center rounded-xl border border-brown-100 bg-white p-4 shadow-card">
          <Button onClick={openRemit} className="w-full" disabled={outstanding <= 0}>
            <Send className="h-4 w-4" /> Remit to HQ
          </Button>
        </div>
      </div>

      <Card
        title={`Rider Handovers${
          pendingHandoverTotal > 0 ? ` — ${formatBDT(pendingHandoverTotal)} pending` : ""
        }`}
        bodyClassName="p-0"
      >
        <Table
          columns={handoverColumns}
          data={branchHandovers}
          rowKey={(h) => h.id}
          emptyMessage="No rider cash handovers yet."
          className="border-0 shadow-none"
        />
      </Card>

      <Card title="Remittance History" bodyClassName="p-0">
        <Table
          columns={remitColumns}
          data={myRemittances}
          rowKey={(r) => r.id}
          emptyMessage="No remittances yet."
          className="border-0 shadow-none"
        />
      </Card>

      <Card
        title={`COD Collected — Delivered Parcels (${delivered.length})`}
        action={
          <ExportButton
            data={delivered.map((p) => ({
              trackingId: p.trackingId,
              merchant: p.merchantName,
              cod: collectedCodOf(p),
              date: p.createdAt,
            }))}
            filename="hub-cod.csv"
          />
        }
        bodyClassName="p-0"
      >
        <Table
          columns={deliveredColumns}
          data={delivered}
          rowKey={(p) => p.id}
          emptyMessage="No COD collected at this hub yet."
          className="border-0 shadow-none"
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Remit COD to HQ"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>Submit Remittance</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-brown-600">
            Outstanding:{" "}
            <span className="font-semibold text-warning-600">{formatBDT(outstanding)}</span>
          </div>
          <Input
            label="Amount (৳)"
            type="number"
            value={form.amount}
            onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
          />
          <Input
            label="Reference"
            value={form.reference}
            onChange={(e) => setForm((f) => ({ ...f, reference: e.target.value }))}
            placeholder="e.g. RMT-2025-XXXX / deposit slip no."
          />
          <Input
            label="Note (optional)"
            value={form.note}
            onChange={(e) => setForm((f) => ({ ...f, note: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
