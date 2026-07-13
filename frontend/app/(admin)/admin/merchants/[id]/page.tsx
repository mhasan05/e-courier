"use client";

import { useState } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Phone, MapPin, Mail, Calendar, Briefcase, Building2, Pencil, Check, Ban } from "lucide-react";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import Table, { type Column } from "@/components/ui/Table";
import PanelLoading from "@/components/layout/PanelLoading";
import { useToast } from "@/components/ui/Toast";
import { useHydrated } from "@/hooks/useHydrated";
import { useParcels, reassignMerchantParcels } from "@/lib/parcel-store";
import {
  useMerchants,
  useMerchantsReady,
  assignMerchantBranch,
  setMerchantStatus,
  updateMerchant,
} from "@/lib/merchant-store";
import { useBranches } from "@/lib/branch-store";
import { BD_DISTRICTS } from "@/lib/constants";
import { formatBDT, formatDate, merchantCode } from "@/lib/utils";
import type { Parcel, MerchantStatus } from "@/types";

export default function MerchantDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const toast = useToast();
  const hydrated = useHydrated();
  const ready = useMerchantsReady();
  const allParcels = useParcels();
  const merchants = useMerchants();
  const branches = useBranches();
  const merchant = merchants.find((m) => m.id === Number(params.id));

  const [editOpen, setEditOpen] = useState(false);
  const [statusTarget, setStatusTarget] = useState<MerchantStatus | null>(null);
  const [form, setForm] = useState({
    name: "",
    shopName: "",
    phone: "",
    email: "",
    address: "",
    district: "",
    businessType: "",
  });

  if (!hydrated || !ready) return <PanelLoading />;
  if (!merchant) notFound();

  const merchantParcels = allParcels.filter((p) => p.merchantId === merchant.id);

  const assignHub = async (branchId: number) => {
    try {
      await assignMerchantBranch(merchant.id, branchId);
      reassignMerchantParcels(merchant.id, branchId);
      const b = branches.find((x) => x.id === branchId);
      toast.success(`${merchant.shopName} assigned to ${b?.name ?? "hub"}`);
    } catch {
      toast.error("Could not reassign hub.");
    }
  };

  const confirmStatus = async () => {
    if (!statusTarget) return;
    try {
      await setMerchantStatus(merchant.id, statusTarget);
      toast.success(
        statusTarget === "active"
          ? `${merchant.shopName} approved`
          : `${merchant.shopName} suspended`,
      );
      setStatusTarget(null);
    } catch {
      toast.error("Could not update status.");
    }
  };

  const openEdit = () => {
    setForm({
      name: merchant.name,
      shopName: merchant.shopName,
      phone: merchant.phone,
      email: merchant.email,
      address: merchant.address,
      district: merchant.district,
      businessType: merchant.businessType,
    });
    setEditOpen(true);
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const saveEdit = async () => {
    if (!form.name.trim() || !form.shopName.trim() || !form.phone.trim()) {
      toast.error("Owner name, shop name and phone are required");
      return;
    }
    try {
      await updateMerchant(merchant.id, {
        name: form.name.trim(),
        shopName: form.shopName.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        address: form.address.trim(),
        district: form.district,
        businessType: form.businessType.trim(),
      });
      toast.success("Merchant details updated");
      setEditOpen(false);
    } catch {
      toast.error("Could not update merchant.");
    }
  };

  const infoRows = [
    { icon: Mail, label: "Email", value: merchant.email },
    { icon: Phone, label: "Phone", value: merchant.phone },
    { icon: MapPin, label: "Address", value: merchant.address },
    { icon: Briefcase, label: "Business", value: merchant.businessType },
    { icon: Calendar, label: "Joined", value: formatDate(merchant.joinDate) },
  ];

  const codCards = [
    { label: "Total Collected", value: merchant.codCollected, accent: "text-brown-800" },
    { label: "Disbursed", value: merchant.codDisbursed, accent: "text-primary" },
    { label: "Pending", value: merchant.codPending, accent: "text-warning-600" },
  ];

  const columns: Column<Parcel>[] = [
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => (
        <Link
          href={`/admin/parcels/${p.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {p.trackingId}
        </Link>
      ),
    },
    { key: "recipientName", header: "Recipient" },
    { key: "district", header: "District" },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href="/admin/merchants"
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to merchants
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit Details
          </Button>
          {merchant.status === "active" ? (
            <Button variant="danger" size="sm" onClick={() => setStatusTarget("suspended")}>
              <Ban className="h-4 w-4" /> Suspend
            </Button>
          ) : (
            <Button size="sm" onClick={() => setStatusTarget("active")}>
              <Check className="h-4 w-4" /> Approve
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 items-center justify-center rounded-xl bg-primary text-2xl font-semibold text-white">
              {merchant.name.charAt(0)}
            </span>
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-brown-800">
                  {merchant.shopName}
                </h2>
                <StatusBadge kind="merchant" status={merchant.status} />
              </div>
              <p className="text-sm text-brown-500">{merchant.name}</p>
              <span className="mt-1 inline-block rounded-md bg-primary-50 px-2 py-0.5 font-mono text-xs font-medium text-primary-700">
                {merchantCode(merchant.id)}
              </span>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {infoRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-brown-400" />
                  <div>
                    <dt className="text-xs text-brown-500">{row.label}</dt>
                    <dd className="text-sm text-brown-700">{row.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>
        </Card>

        <div className="space-y-4">
          {/* Managing hub */}
          <Card title="Managing Hub">
            <p className="mb-2 flex items-center gap-2 text-sm text-brown-500">
              <Building2 className="h-4 w-4 text-brown-400" />
              This hub &amp; HQ exclusively manage this merchant&apos;s parcels.
            </p>
            <Select
              value={merchant.homeBranchId ? String(merchant.homeBranchId) : ""}
              onChange={(e) => assignHub(Number(e.target.value))}
              placeholder="Assign a hub"
              options={branches.map((b) => ({
                value: String(b.id),
                label: `${b.name} (${b.code})`,
              }))}
            />
          </Card>

          {/* COD balance */}
          <Card title="COD Balance">
            <div className="space-y-3">
              {codCards.map((c) => (
                <div
                  key={c.label}
                  className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2.5"
                >
                  <span className="text-sm text-brown-500">{c.label}</span>
                  <span className={`text-base font-semibold ${c.accent}`}>
                    {formatBDT(c.value)}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <Card
        title={`Parcel History (${merchantParcels.length})`}
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={merchantParcels}
          rowKey={(p) => p.id}
          emptyMessage="This merchant has no parcels yet."
          className="border-0 shadow-none"
        />
      </Card>

      {/* Status change confirmation */}
      <Modal
        open={!!statusTarget}
        onClose={() => setStatusTarget(null)}
        title={statusTarget === "active" ? "Approve merchant?" : "Suspend merchant?"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setStatusTarget(null)}>Cancel</Button>
            <Button
              variant={statusTarget === "active" ? "primary" : "danger"}
              onClick={confirmStatus}
            >
              {statusTarget === "active" ? "Approve" : "Suspend"}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-brown-600">
          <div className="flex items-center gap-2">
            <span className="text-brown-500">Current status:</span>
            <StatusBadge kind="merchant" status={merchant.status} />
          </div>
          <p>
            {statusTarget === "active" ? (
              <>This will <span className="font-medium text-primary">activate</span> {merchant.shopName} so they can book parcels.</>
            ) : (
              <>This will <span className="font-medium text-red-600">suspend</span> {merchant.shopName}. They won&apos;t be able to book new parcels.</>
            )}
          </p>
        </div>
      </Modal>

      {/* Edit details modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Merchant Details"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <Input label="Shop name" value={form.shopName} onChange={(e) => set("shopName", e.target.value)} />
          <Input label="Owner name" value={form.name} onChange={(e) => set("name", e.target.value)} />
          <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
          <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
          <Input label="Business type" value={form.businessType} onChange={(e) => set("businessType", e.target.value)} />
          <Select
            label="District"
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
            placeholder="Select district"
            options={BD_DISTRICTS.map((d) => ({ value: d, label: d }))}
          />
          <div className="sm:col-span-2">
            <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
          </div>
        </div>
      </Modal>
    </div>
  );
}
