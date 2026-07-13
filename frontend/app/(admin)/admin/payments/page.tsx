"use client";

import { useState } from "react";
import { Plus, Pencil, Check, X } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Tabs from "@/components/ui/Tabs";
import Table, { type Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import {
  useAvailableMethods,
  addAvailableMethod,
  updateAvailableMethod,
  toggleAvailableMethod,
  useWithdrawals,
  setWithdrawalStatus,
} from "@/lib/payment-store";
import { WITHDRAWAL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate } from "@/lib/utils";
import type {
  AvailablePaymentMethod,
  PayoutMethodType,
  WithdrawalRequest,
} from "@/types";

type MethodForm = {
  name: string;
  type: PayoutMethodType;
  minAmount: string;
  chargePercent: string;
  instructions: string;
};

const emptyMethod: MethodForm = {
  name: "",
  type: "mobile",
  minAmount: "500",
  chargePercent: "0",
  instructions: "",
};

export default function AdminPaymentsPage() {
  const toast = useToast();
  const [tab, setTab] = useState("methods");
  const methods = useAvailableMethods();
  const withdrawals = useWithdrawals();

  const pendingCount = withdrawals.filter((w) => w.status === "pending").length;

  return (
    <div className="space-y-4">
      <Tabs
        value={tab}
        onChange={setTab}
        tabs={[
          { label: "Payment Methods", value: "methods", count: methods.length },
          { label: "Withdrawal Requests", value: "withdrawals", count: pendingCount },
        ]}
      />
      {tab === "methods" ? (
        <MethodsTab methods={methods} toast={toast} />
      ) : (
        <WithdrawalsTab withdrawals={withdrawals} toast={toast} />
      )}
    </div>
  );
}

// ---- Tab 1: manage available payment methods ----
function MethodsTab({
  methods,
  toast,
}: {
  methods: AvailablePaymentMethod[];
  toast: ReturnType<typeof useToast>;
}) {
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<MethodForm>(emptyMethod);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyMethod);
    setOpen(true);
  };
  const openEdit = (m: AvailablePaymentMethod) => {
    setEditingId(m.id);
    setForm({
      name: m.name,
      type: m.type,
      minAmount: String(m.minAmount),
      chargePercent: String(m.chargePercent),
      instructions: m.instructions ?? "",
    });
    setOpen(true);
  };

  const save = () => {
    if (!form.name.trim()) {
      toast.error("Method name is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      type: form.type,
      minAmount: Number(form.minAmount) || 0,
      chargePercent: Number(form.chargePercent) || 0,
      instructions: form.instructions.trim() || undefined,
    };
    void (async () => {
      try {
        if (editingId !== null) {
          await updateAvailableMethod(editingId, payload);
          toast.success(`${payload.name} updated`);
        } else {
          await addAvailableMethod(payload);
          toast.success(`${payload.name} added`);
        }
        setOpen(false);
      } catch {
        toast.error("Could not save the payment method.");
      }
    })();
  };

  const columns: Column<AvailablePaymentMethod>[] = [
    { key: "name", header: "Method", render: (m) => (
      <span className="font-medium text-brown-800">{m.name}</span>
    ) },
    { key: "type", header: "Type", render: (m) => (
      <span className="capitalize">{m.type === "bank" ? "Bank" : "Mobile Wallet"}</span>
    ) },
    { key: "minAmount", header: "Min Withdrawal", render: (m) => formatBDT(m.minAmount) },
    { key: "chargePercent", header: "Charge", render: (m) => `${m.chargePercent}%` },
    {
      key: "isActive",
      header: "Status",
      render: (m) =>
        m.isActive ? (
          <Badge className="bg-primary-100 text-primary-700">Active</Badge>
        ) : (
          <Badge className="bg-brown-100 text-brown-500">Disabled</Badge>
        ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (m) => (
        <div className="flex justify-end gap-1.5">
          <Button size="sm" variant="ghost" onClick={() => openEdit(m)}>
            <Pencil className="h-4 w-4" /> Edit
          </Button>
          <Button
            size="sm"
            variant={m.isActive ? "danger" : "outline"}
            onClick={() => toggleAvailableMethod(m.id)}
          >
            {m.isActive ? "Disable" : "Enable"}
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-3">
      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Method
        </Button>
      </div>
      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={methods}
          rowKey={(m) => m.id}
          emptyMessage="No payment methods configured."
          className="border-0 shadow-none"
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId !== null ? "Edit Payment Method" : "Add Payment Method"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Method name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
            placeholder="e.g. bKash, Bank Transfer"
          />
          <Select
            label="Type"
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as PayoutMethodType }))}
            options={[
              { value: "mobile", label: "Mobile Wallet" },
              { value: "bank", label: "Bank" },
            ]}
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Min withdrawal (৳)"
              type="number"
              value={form.minAmount}
              onChange={(e) => setForm((f) => ({ ...f, minAmount: e.target.value }))}
            />
            <Input
              label="Charge (%)"
              type="number"
              value={form.chargePercent}
              onChange={(e) => setForm((f) => ({ ...f, chargePercent: e.target.value }))}
            />
          </div>
          <Input
            label="Instructions (optional)"
            value={form.instructions}
            onChange={(e) => setForm((f) => ({ ...f, instructions: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}

// ---- Tab 2: process withdrawal requests ----
function WithdrawalsTab({
  withdrawals,
  toast,
}: {
  withdrawals: WithdrawalRequest[];
  toast: ReturnType<typeof useToast>;
}) {
  const [payTarget, setPayTarget] = useState<WithdrawalRequest | null>(null);
  const [reference, setReference] = useState("");

  const sorted = [...withdrawals].sort((a, b) =>
    b.requestedAt.localeCompare(a.requestedAt),
  );

  const approve = (w: WithdrawalRequest) => {
    setWithdrawalStatus(w.id, "approved");
    toast.success(`${w.merchantName}'s request approved`);
  };
  const reject = (w: WithdrawalRequest) => {
    setWithdrawalStatus(w.id, "rejected", { note: "Rejected by admin" });
    toast.success(`${w.merchantName}'s request rejected`);
  };
  const markPaid = () => {
    if (!payTarget) return;
    if (!reference.trim()) {
      toast.error("Transaction reference is required");
      return;
    }
    setWithdrawalStatus(payTarget.id, "paid", { reference: reference.trim() });
    toast.success(`Marked ${formatBDT(payTarget.amount)} as paid`);
    setPayTarget(null);
    setReference("");
  };

  const columns: Column<WithdrawalRequest>[] = [
    { key: "requestedAt", header: "Date", render: (w) => formatDate(w.requestedAt) },
    { key: "merchantName", header: "Merchant" },
    { key: "amount", header: "Amount", render: (w) => formatBDT(w.amount) },
    { key: "payoutLabel", header: "Payout To", render: (w) => (
      <span className="text-xs text-brown-600">{w.payoutLabel}</span>
    ) },
    {
      key: "status",
      header: "Status",
      render: (w) => {
        const meta = WITHDRAWAL_STATUS_META[w.status];
        return (
          <span className={`inline-flex rounded-full px-2.5 py-0.5 text-xs font-medium ${meta.classes}`}>
            {meta.label}
          </span>
        );
      },
    },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (w) => (
        <div className="flex justify-end gap-1.5">
          {w.status === "pending" && (
            <>
              <Button size="sm" variant="outline" onClick={() => approve(w)}>
                <Check className="h-4 w-4" /> Approve
              </Button>
              <Button size="sm" variant="danger" onClick={() => reject(w)}>
                <X className="h-4 w-4" /> Reject
              </Button>
            </>
          )}
          {w.status === "approved" && (
            <Button size="sm" onClick={() => { setPayTarget(w); setReference(""); }}>
              Mark Paid
            </Button>
          )}
          {(w.status === "paid" || w.status === "rejected") && (
            <span className="text-xs text-brown-400">
              {w.reference || w.note || "—"}
            </span>
          )}
        </div>
      ),
    },
  ];

  return (
    <>
      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={sorted}
          rowKey={(w) => w.id}
          emptyMessage="No withdrawal requests."
          className="border-0 shadow-none"
        />
      </Card>

      <Modal
        open={!!payTarget}
        onClose={() => setPayTarget(null)}
        title={payTarget ? `Mark Paid — ${payTarget.merchantName}` : ""}
        footer={
          <>
            <Button variant="ghost" onClick={() => setPayTarget(null)}>Cancel</Button>
            <Button onClick={markPaid}>Confirm Payment</Button>
          </>
        }
      >
        {payTarget && (
          <div className="space-y-3">
            <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-brown-600">
              Paying{" "}
              <span className="font-semibold text-brown-800">{formatBDT(payTarget.amount)}</span>{" "}
              to {payTarget.payoutLabel}
            </div>
            <Input
              label="Transaction reference"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="e.g. TRX-2025-XXXX"
            />
          </div>
        )}
      </Modal>
    </>
  );
}
