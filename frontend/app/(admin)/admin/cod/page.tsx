"use client";

import { useEffect, useMemo, useState } from "react";
import { Wallet, CheckCircle2, Building2, Send, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import SearchInput from "@/components/ui/SearchInput";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { useParcels } from "@/lib/parcel-store";
import { useBranches } from "@/lib/branch-store";
import { useRemittances, confirmRemittance, remittedForBranch } from "@/lib/remittance-store";
import { useMerchants } from "@/lib/merchant-store";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Merchant, Branch, HubRemittance } from "@/types";

export default function AdminCodPage() {
  const [tab, setTab] = useState("merchants");
  const remittances = useRemittances();
  const pendingRemits = remittances.filter((r) => r.status === "pending").length;

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { label: "Merchant Balances", value: "merchants" },
          { label: "Hub Remittances", value: "hubs", count: pendingRemits },
        ]}
      />
      {tab === "merchants" ? <MerchantBalancesTab /> : <HubRemittancesTab />}
    </div>
  );
}

// ---- Tab 1: HQ → merchant COD disbursement (existing) ----
interface PayForm {
  amount: string;
  bankName: string;
  reference: string;
  date: string;
}
const emptyPay: PayForm = { amount: "", bankName: "", reference: "", date: "" };

function MerchantBalancesTab() {
  const toast = useToast();
  // Real merchant balances from the API; kept in local state so a disbursement
  // reflects immediately (persistence lands with the Payments module).
  const apiMerchants = useMerchants();
  const [rows, setRows] = useState<Merchant[]>([]);
  useEffect(() => setRows(apiMerchants), [apiMerchants]);
  const [search, setSearch] = useState("");
  const [payTarget, setPayTarget] = useState<Merchant | null>(null);
  const [pay, setPay] = useState<PayForm>(emptyPay);

  const totals = useMemo(
    () => ({
      collected: rows.reduce((s, m) => s + m.codCollected, 0),
      disbursed: rows.reduce((s, m) => s + m.codDisbursed, 0),
      pending: rows.reduce((s, m) => s + m.codPending, 0),
    }),
    [rows],
  );

  const filtered = rows.filter((m) =>
    m.shopName.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const openPay = (m: Merchant) => {
    setPayTarget(m);
    setPay({ ...emptyPay, amount: String(m.codPending) });
  };

  const confirmPay = () => {
    if (!payTarget) return;
    const amount = Number(pay.amount) || 0;
    if (amount <= 0 || amount > payTarget.codPending) {
      toast.error("Amount must be between 1 and the pending balance");
      return;
    }
    if (!pay.bankName.trim() || !pay.reference.trim()) {
      toast.error("Bank name and reference are required");
      return;
    }
    setRows((prev) =>
      prev.map((m) =>
        m.id === payTarget.id
          ? { ...m, codDisbursed: m.codDisbursed + amount, codPending: m.codPending - amount }
          : m,
      ),
    );
    toast.success(`${formatBDT(amount)} marked paid to ${payTarget.shopName}`);
    setPayTarget(null);
  };

  const columns: Column<Merchant>[] = [
    {
      key: "shopName",
      header: "Merchant",
      render: (m) => (
        <div>
          <p className="font-medium text-brown-800">{m.shopName}</p>
          <p className="text-xs text-brown-500">{m.name}</p>
        </div>
      ),
    },
    { key: "codCollected", header: "Collected", render: (m) => formatBDT(m.codCollected) },
    { key: "codDisbursed", header: "Disbursed", render: (m) => formatBDT(m.codDisbursed) },
    {
      key: "codPending",
      header: "Pending",
      render: (m) => (
        <span className={m.codPending > 0 ? "font-medium text-warning-600" : "text-brown-500"}>
          {formatBDT(m.codPending)}
        </span>
      ),
    },
    {
      key: "status",
      header: "",
      className: "text-right",
      render: (m) =>
        m.codPending > 0 ? (
          <Button size="sm" variant="outline" onClick={() => openPay(m)}>
            Mark Paid
          </Button>
        ) : (
          <Badge className="bg-primary-100 text-primary-700">Settled</Badge>
        ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Collected" value={formatBDT(totals.collected)} icon={Wallet} accent="brown" />
        <StatCard label="Total Disbursed" value={formatBDT(totals.disbursed)} icon={CheckCircle2} />
        <StatCard label="Total Pending" value={formatBDT(totals.pending)} icon={Wallet} accent="amber" />
      </div>

      <div className="flex justify-end">
        <SearchInput value={search} onChange={setSearch} placeholder="Search merchant…" className="w-full sm:w-72" />
      </div>

      <Card bodyClassName="p-0">
        <Table columns={columns} data={filtered} rowKey={(m) => m.id} emptyMessage="No merchants found." className="border-0 shadow-none" />
      </Card>

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={payTarget ? `Mark COD Paid — ${payTarget.shopName}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button onClick={confirmPay}>Confirm Payment</Button>
          </>
        }
      >
        {payTarget && (
          <div className="space-y-3">
            <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-brown-600">
              Pending balance:{" "}
              <span className="font-semibold text-warning-600">{formatBDT(payTarget.codPending)}</span>
            </div>
            <Input label="Amount (৳)" type="number" value={pay.amount} onChange={(e) => setPay((p) => ({ ...p, amount: e.target.value }))} />
            <Input label="Bank name" value={pay.bankName} onChange={(e) => setPay((p) => ({ ...p, bankName: e.target.value }))} placeholder="e.g. BRAC Bank" />
            <Input label="Reference number" value={pay.reference} onChange={(e) => setPay((p) => ({ ...p, reference: e.target.value }))} placeholder="TRX-2025-XXXX" />
            <Input label="Payment date" type="date" value={pay.date} onChange={(e) => setPay((p) => ({ ...p, date: e.target.value }))} />
          </div>
        )}
      </Modal>
    </div>
  );
}

// ---- Tab 2: hub → HQ COD reconciliation (new) ----
interface HubRow {
  branch: Branch;
  collected: number;
  received: number;
  inTransit: number;
  outstanding: number;
}

function HubRemittancesTab() {
  const toast = useToast();
  const all = useParcels();
  const branches = useBranches();
  const remittances = useRemittances();

  const hubRows = useMemo<HubRow[]>(() => {
    return branches.map((b) => {
      const collected = all
        .filter((p) => p.ownerBranchId === b.id && p.status === "delivered")
        .reduce((s, p) => s + p.codAmount, 0);
      const received = remittances
        .filter((r) => r.branchId === b.id && r.status === "received")
        .reduce((s, r) => s + r.amount, 0);
      const sent = remittedForBranch(remittances, b.id);
      const inTransit = sent - received;
      return {
        branch: b,
        collected,
        received,
        inTransit,
        outstanding: Math.max(0, collected - sent),
      };
    });
  }, [all, branches, remittances]);

  const totals = hubRows.reduce(
    (acc, r) => ({
      collected: acc.collected + r.collected,
      received: acc.received + r.received,
      inTransit: acc.inTransit + r.inTransit,
      outstanding: acc.outstanding + r.outstanding,
    }),
    { collected: 0, received: 0, inTransit: 0, outstanding: 0 },
  );

  const sortedRemits = [...remittances].sort((a, b) =>
    b.remittedAt.localeCompare(a.remittedAt),
  );
  const branchById = new Map(branches.map((b) => [b.id, b]));

  const hubColumns: Column<HubRow>[] = [
    { key: "hub", header: "Hub", render: (r) => (
      <div className="flex items-center gap-2">
        <Building2 className="h-4 w-4 text-brown-400" />
        <span className="font-medium text-brown-800">{r.branch.name}</span>
        <span className="font-mono text-xs text-brown-500">{r.branch.code}</span>
      </div>
    ) },
    { key: "collected", header: "Collected", render: (r) => formatBDT(r.collected) },
    { key: "received", header: "Received by HQ", render: (r) => formatBDT(r.received) },
    { key: "inTransit", header: "In Transit", render: (r) => formatBDT(r.inTransit) },
    { key: "outstanding", header: "Outstanding", render: (r) => (
      <span className={r.outstanding > 0 ? "font-medium text-warning-600" : "text-brown-500"}>
        {formatBDT(r.outstanding)}
      </span>
    ) },
  ];

  const remitColumns: Column<HubRemittance>[] = [
    { key: "remittedAt", header: "Date", render: (r) => formatDate(r.remittedAt) },
    { key: "hub", header: "Hub", render: (r) => branchById.get(r.branchId)?.code ?? "—" },
    { key: "amount", header: "Amount", render: (r) => formatBDT(r.amount) },
    { key: "reference", header: "Reference", render: (r) => (
      <span className="font-mono text-xs">{r.reference}</span>
    ) },
    { key: "status", header: "Status", render: (r) =>
      r.status === "received" ? (
        <Badge className="bg-primary-100 text-primary-700">Received</Badge>
      ) : (
        <Badge className="bg-warning-100 text-warning-700">In transit</Badge>
      ) },
    { key: "actions", header: "", className: "text-right", render: (r) =>
      r.status === "pending" ? (
        <Button size="sm" variant="outline" onClick={async () => { try { await confirmRemittance(r.id); toast.success(`Confirmed ${formatBDT(r.amount)} from ${branchById.get(r.branchId)?.code}`); } catch { toast.error("Could not confirm remittance."); } }}>
          Confirm Receipt
        </Button>
      ) : null,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Hub COD Collected" value={formatBDT(totals.collected)} icon={Wallet} accent="brown" />
        <StatCard label="Received by HQ" value={formatBDT(totals.received)} icon={CheckCircle2} />
        <StatCard label="In Transit" value={formatBDT(totals.inTransit)} icon={Send} accent="amber" />
        <StatCard label="Outstanding at Hubs" value={formatBDT(totals.outstanding)} icon={Clock} accent="amber" />
      </div>

      <Card title="Per-Hub COD" bodyClassName="p-0">
        <Table columns={hubColumns} data={hubRows} rowKey={(r) => r.branch.id} emptyMessage="No hubs configured." className="border-0 shadow-none" />
      </Card>

      <Card title="Remittances" bodyClassName="p-0">
        <Table columns={remitColumns} data={sortedRemits} rowKey={(r) => r.id} emptyMessage="No remittances yet." className="border-0 shadow-none" />
      </Card>
    </div>
  );
}
