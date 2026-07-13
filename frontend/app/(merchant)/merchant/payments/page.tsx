"use client";

import { useMemo, useState } from "react";
import { Wallet, Plus, Trash2, Star, CreditCard, Landmark, Smartphone } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Table, { type Column } from "@/components/ui/Table";
import StatCard from "@/components/ui/StatCard";
import { useToast } from "@/components/ui/Toast";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import {
  useAvailableMethods,
  usePayoutMethods,
  addPayoutMethod,
  removePayoutMethod,
  setDefaultPayoutMethod,
  useWithdrawals,
  addWithdrawal,
} from "@/lib/payment-store";
import { WITHDRAWAL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate } from "@/lib/utils";
import type { WithdrawalRequest, MerchantPayoutMethod } from "@/types";

export default function MerchantPaymentsPage() {
  const toast = useToast();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const available = useAvailableMethods().filter((m) => m.isActive);
  const allPayouts = usePayoutMethods();
  const allWithdrawals = useWithdrawals();

  const myMethods = useMemo(
    () => allPayouts.filter((p) => p.merchantId === me.id),
    [allPayouts, me.id],
  );
  const myWithdrawals = useMemo(
    () =>
      allWithdrawals
        .filter((w) => w.merchantId === me.id)
        .sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)),
    [allWithdrawals, me.id],
  );

  // Available balance = COD pending, minus amounts locked in open requests.
  const locked = myWithdrawals
    .filter((w) => w.status === "pending" || w.status === "approved")
    .reduce((s, w) => s + w.amount, 0);
  const balance = Math.max(0, me.codPending - locked);

  const [methodOpen, setMethodOpen] = useState(false);
  const [reqOpen, setReqOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<MerchantPayoutMethod | null>(null);

  const confirmDelete = () => {
    if (!deleteTarget) return;
    removePayoutMethod(deleteTarget.id);
    toast.success("Payout method removed");
    setDeleteTarget(null);
  };

  // ---- Add payout method form ----
  const [mForm, setMForm] = useState({
    methodId: "",
    accountName: "",
    accountNumber: "",
    bankName: "",
    branch: "",
  });
  const selectedAvailable = available.find((m) => m.id === Number(mForm.methodId));
  const isBank = selectedAvailable?.type === "bank";

  const saveMethod = async () => {
    if (!selectedAvailable || !mForm.accountName.trim() || !mForm.accountNumber.trim()) {
      toast.error("Select a method and fill account details");
      return;
    }
    if (isBank && !mForm.bankName.trim()) {
      toast.error("Bank name is required");
      return;
    }
    try {
      await addPayoutMethod({
        merchantId: me.id,
        methodId: selectedAvailable.id,
        methodName: selectedAvailable.name,
        type: selectedAvailable.type,
        accountName: mForm.accountName.trim(),
        accountNumber: mForm.accountNumber.trim(),
        bankName: isBank ? mForm.bankName.trim() : undefined,
        branch: isBank ? mForm.branch.trim() || undefined : undefined,
        isDefault: false,
      });
      toast.success(`${selectedAvailable.name} payout method added`);
      setMForm({ methodId: "", accountName: "", accountNumber: "", bankName: "", branch: "" });
      setMethodOpen(false);
    } catch {
      toast.error("Could not add payout method.");
    }
  };

  // ---- Withdrawal request form ----
  const [wForm, setWForm] = useState({ amount: "", payoutMethodId: "" });
  const selectedPayout = myMethods.find((p) => p.id === Number(wForm.payoutMethodId));
  const minAmount =
    available.find((m) => m.id === selectedPayout?.methodId)?.minAmount ?? 0;

  const openRequest = () => {
    if (myMethods.length === 0) {
      toast.error("Add a payout method first");
      return;
    }
    const def = myMethods.find((m) => m.isDefault) ?? myMethods[0];
    setWForm({ amount: "", payoutMethodId: String(def.id) });
    setReqOpen(true);
  };

  const submitRequest = () => {
    const amount = Number(wForm.amount) || 0;
    if (!selectedPayout) {
      toast.error("Select a payout method");
      return;
    }
    if (amount < minAmount) {
      toast.error(`Minimum withdrawal is ${formatBDT(minAmount)}`);
      return;
    }
    if (amount > balance) {
      toast.error("Amount exceeds your available balance");
      return;
    }
    void (async () => {
      try {
        await addWithdrawal({
          merchantId: me.id,
          merchantName: me.shopName,
          amount,
          charge: 0,
          payoutMethodId: selectedPayout.id,
          payoutLabel: `${selectedPayout.methodName} · ${selectedPayout.accountNumber}`,
        });
        toast.success("Withdrawal request submitted");
        setReqOpen(false);
      } catch {
        toast.error("Could not submit the withdrawal request.");
      }
    })();
  };

  const columns: Column<WithdrawalRequest>[] = [
    { key: "requestedAt", header: "Date", render: (w) => formatDate(w.requestedAt) },
    { key: "amount", header: "Amount", render: (w) => formatBDT(w.amount) },
    { key: "payoutLabel", header: "Method", render: (w) => (
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
      key: "reference",
      header: "Reference",
      render: (w) => w.reference || <span className="text-brown-400">—</span>,
    },
  ];

  const methodIcon = (type: MerchantPayoutMethod["type"]) =>
    type === "bank" ? Landmark : Smartphone;

  return (
    <div className="space-y-5">
      {/* Balance + request */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Available Balance" value={formatBDT(balance)} icon={Wallet} accent="brown" />
        <StatCard label="In Process" value={formatBDT(locked)} icon={CreditCard} accent="amber" />
        <div className="flex items-center justify-center rounded-xl border border-brown-100 bg-white p-4 shadow-card">
          <Button onClick={openRequest} className="w-full">
            <Plus className="h-4 w-4" /> Request Withdrawal
          </Button>
        </div>
      </div>

      {/* Payout methods */}
      <Card
        title="Payout Methods"
        action={
          <Button size="sm" variant="outline" onClick={() => setMethodOpen(true)}>
            <Plus className="h-4 w-4" /> Add Method
          </Button>
        }
      >
        {myMethods.length === 0 ? (
          <p className="text-sm text-brown-500">
            No payout methods yet. Add one to request withdrawals.
          </p>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {myMethods.map((m) => {
              const Icon = methodIcon(m.type);
              return (
                <div key={m.id} className="rounded-xl border border-brown-100 p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2">
                      <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                        <Icon className="h-4 w-4" />
                      </span>
                      <div>
                        <p className="flex items-center gap-2 font-medium text-brown-800">
                          {m.methodName}
                          {m.isDefault && (
                            <Badge className="bg-primary-100 text-primary-700">Default</Badge>
                          )}
                        </p>
                        <p className="text-xs text-brown-500">{m.accountName}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setDeleteTarget(m)}
                      className="rounded-md p-1.5 text-brown-400 hover:bg-red-50 hover:text-red-500"
                      aria-label="Remove method"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-2 font-mono text-sm text-brown-700">{m.accountNumber}</p>
                  {m.bankName && (
                    <p className="text-xs text-brown-500">
                      {m.bankName}{m.branch ? ` · ${m.branch}` : ""}
                    </p>
                  )}
                  {!m.isDefault && (
                    <button
                      onClick={() => setDefaultPayoutMethod(m.id, me.id)}
                      className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                    >
                      <Star className="h-3 w-3" /> Set as default
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </Card>

      {/* History */}
      <Card title="Withdrawal Requests" bodyClassName="p-0">
        <Table
          columns={columns}
          data={myWithdrawals}
          rowKey={(w) => w.id}
          emptyMessage="No withdrawal requests yet."
          className="border-0 shadow-none"
        />
      </Card>

      {/* Add method modal */}
      <Modal
        open={methodOpen}
        onClose={() => setMethodOpen(false)}
        title="Add Payout Method"
        footer={
          <>
            <Button variant="ghost" onClick={() => setMethodOpen(false)}>Cancel</Button>
            <Button onClick={saveMethod}>Save Method</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Select
            label="Payment method"
            value={mForm.methodId}
            onChange={(e) => setMForm((f) => ({ ...f, methodId: e.target.value }))}
            placeholder="Select method"
            options={available.map((m) => ({ value: String(m.id), label: m.name }))}
          />
          {selectedAvailable?.instructions && (
            <p className="rounded-lg bg-canvas px-3 py-2 text-xs text-brown-500">
              {selectedAvailable.instructions}
            </p>
          )}
          <Input
            label="Account holder name"
            value={mForm.accountName}
            onChange={(e) => setMForm((f) => ({ ...f, accountName: e.target.value }))}
          />
          <Input
            label={isBank ? "Account number" : "Mobile number"}
            value={mForm.accountNumber}
            onChange={(e) => setMForm((f) => ({ ...f, accountNumber: e.target.value }))}
            placeholder={isBank ? "Bank account number" : "01XXXXXXXXX"}
          />
          {isBank && (
            <div className="grid grid-cols-2 gap-3">
              <Input
                label="Bank name"
                value={mForm.bankName}
                onChange={(e) => setMForm((f) => ({ ...f, bankName: e.target.value }))}
              />
              <Input
                label="Branch"
                value={mForm.branch}
                onChange={(e) => setMForm((f) => ({ ...f, branch: e.target.value }))}
              />
            </div>
          )}
        </div>
      </Modal>

      {/* Request withdrawal modal */}
      <Modal
        open={reqOpen}
        onClose={() => setReqOpen(false)}
        title="Request Withdrawal"
        footer={
          <>
            <Button variant="ghost" onClick={() => setReqOpen(false)}>Cancel</Button>
            <Button onClick={submitRequest}>Submit Request</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="rounded-lg bg-canvas px-3 py-2 text-sm text-brown-600">
            Available balance:{" "}
            <span className="font-semibold text-brown-800">{formatBDT(balance)}</span>
          </div>
          <Select
            label="Payout to"
            value={wForm.payoutMethodId}
            onChange={(e) => setWForm((f) => ({ ...f, payoutMethodId: e.target.value }))}
            options={myMethods.map((m) => ({
              value: String(m.id),
              label: `${m.methodName} · ${m.accountNumber}`,
            }))}
          />
          <Input
            label={`Amount (min ${formatBDT(minAmount)})`}
            type="number"
            value={wForm.amount}
            onChange={(e) => setWForm((f) => ({ ...f, amount: e.target.value }))}
          />
        </div>
      </Modal>

      {/* Delete payout method confirmation */}
      <Modal
        open={!!deleteTarget}
        onClose={() => setDeleteTarget(null)}
        title="Remove payout method?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete}>Remove</Button>
          </>
        }
      >
        <p className="text-sm text-brown-600">
          Remove{" "}
          <span className="font-medium text-brown-800">
            {deleteTarget?.methodName} · {deleteTarget?.accountNumber}
          </span>
          ? This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
