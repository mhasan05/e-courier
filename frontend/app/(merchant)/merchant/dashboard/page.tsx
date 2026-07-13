"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Package,
  CheckCircle2,
  RotateCcw,
  Wallet,
  Plus,
  ArrowRight,
  Truck,
  XCircle,
} from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import Table, { type Column } from "@/components/ui/Table";
import ParcelTrendChart from "@/components/charts/ParcelTrendChart";
import { useParcels } from "@/lib/parcel-store";
import { useWithdrawals } from "@/lib/payment-store";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { dailyVolume } from "@/lib/analytics";
import { formatBDT, formatDate, merchantCode } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function MerchantDashboardPage() {
  const router = useRouter();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useParcels();
  const withdrawals = useWithdrawals();
  const myParcels = all.filter((p) => p.merchantId === me.id);

  const delivered = myParcels.filter((p) => p.status === "delivered").length;
  const returned = myParcels.filter((p) => p.status === "returned").length;
  const cancelled = myParcels.filter((p) => p.status === "cancelled").length;
  const trend = dailyVolume(myParcels);

  // Ongoing = parcels still in motion (not delivered/returned/cancelled).
  const DONE: Parcel["status"][] = ["delivered", "returned", "cancelled"];
  const ongoing = myParcels
    .filter((p) => !DONE.includes(p.status))
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  // Withdrawable balance = COD pending minus amounts locked in open requests
  // (kept consistent with the Payments page).
  const locked = withdrawals
    .filter(
      (w) =>
        w.merchantId === me.id &&
        (w.status === "pending" || w.status === "approved"),
    )
    .reduce((s, w) => s + w.amount, 0);
  const balance = Math.max(0, me.codPending - locked);

  const recent = [...myParcels]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const columns: Column<Parcel>[] = [
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => (
        <Link
          href={`/merchant/parcels/${p.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {p.trackingId}
        </Link>
      ),
    },
    { key: "recipientName", header: "Recipient" },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-brown-800">
            Welcome, {me.shopName}
          </h2>
          <div className="mt-1 flex items-center gap-2 text-sm text-brown-500">
            <span>Merchant ID:</span>
            <span className="rounded-md bg-primary-50 px-2 py-0.5 font-mono text-xs font-medium text-primary-700">
              {merchantCode(me.id)}
            </span>
          </div>
        </div>
        <Link href="/merchant/parcels/new">
          <Button>
            <Plus className="h-4 w-4" /> Book Parcel
          </Button>
        </Link>
      </div>

      {/* Balance */}
      <div className="flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-gradient-to-br from-primary-700 to-primary p-6 text-white shadow-card">
        <div className="flex items-center gap-4">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-white/15">
            <Wallet className="h-6 w-6" />
          </span>
          <div>
            <p className="text-sm text-primary-100">Available Balance</p>
            <p className="text-3xl font-semibold tracking-tight">{formatBDT(balance)}</p>
            <p className="mt-0.5 text-xs text-primary-100">
              {locked > 0
                ? `${formatBDT(locked)} in process`
                : "Ready to withdraw"}
            </p>
          </div>
        </div>
        <Link
          href="/merchant/payments"
          className="inline-flex items-center gap-2 rounded-lg bg-white px-5 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
        >
          Withdraw <ArrowRight className="h-4 w-4" />
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Total Parcels" value={myParcels.length} icon={Package} />
        <StatCard label="Ongoing" value={ongoing.length} icon={Truck} accent="amber" />
        <StatCard label="Delivered" value={delivered} icon={CheckCircle2} accent="brown" />
        <StatCard label="Returned" value={returned} icon={RotateCcw} accent="amber" />
        <StatCard label="Cancelled" value={cancelled} icon={XCircle} accent="brown" />
        <StatCard label="Pending COD" value={formatBDT(me.codPending)} icon={Wallet} />
      </div>

      {/* Ongoing parcels — still in motion */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Truck className="h-4 w-4 text-primary" />
            Ongoing Parcels
            <span className="rounded-full bg-primary-50 px-2 py-0.5 text-xs font-medium text-primary-700">
              {ongoing.length}
            </span>
          </span>
        }
        action={
          <Link href="/merchant/parcels" className="text-xs text-primary hover:underline">
            View all
          </Link>
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={ongoing.slice(0, 6)}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/merchant/parcels/${p.id}`)}
          emptyMessage="No ongoing parcels — everything is delivered or closed."
          className="border-0 shadow-none"
        />
      </Card>

      <Card title="My Parcel Volume (Last 7 Days)">
        <ParcelTrendChart data={trend} />
      </Card>

      <Card
        title="Recent Parcels"
        action={
          <Link href="/merchant/parcels" className="text-xs text-primary hover:underline">
            View all
          </Link>
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={recent}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/merchant/parcels/${p.id}`)}
          emptyMessage="You haven't booked any parcels yet."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
