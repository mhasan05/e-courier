"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Building2, Inbox, CheckCircle2, Send, Wallet } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Table, { type Column } from "@/components/ui/Table";
import { useParcels } from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import { useBranchScope, parcelInBranch } from "@/hooks/useBranchScope";
import { nextHopBranchId } from "@/lib/hubs";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function BranchDashboardPage() {
  const router = useRouter();
  const { branchId, branch } = useBranchScope();
  const all = useParcels();
  const riders = useDeliveryMen();

  if (branchId == null || !branch) {
    return <p className="text-sm text-brown-500">No hub assigned to this account.</p>;
  }

  const hub = all.filter((p) => parcelInBranch(p, branchId));
  const atHub = hub.filter((p) => p.currentBranchId === branchId).length;
  const toDispatch = hub.filter(
    (p) =>
      p.currentBranchId === branchId &&
      nextHopBranchId(p) != null &&
      !["delivered", "returned", "cancelled"].includes(p.status),
  ).length;
  const pendingPickup = all.filter(
    (p) => p.originBranchId === branchId && p.status === "pending",
  ).length;
  const delivered = hub.filter(
    (p) => p.destinationBranchId === branchId && p.status === "delivered",
  );
  const codCollected = delivered.reduce((s, p) => s + p.codAmount, 0);
  const hubRiders = riders.filter((r) => r.branchId === branchId).length;

  const recent = [...hub]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 6);

  const columns: Column<Parcel>[] = [
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
    { key: "merchantName", header: "Merchant" },
    { key: "recipientName", header: "Recipient" },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary">
          <Building2 className="h-5 w-5" />
        </span>
        <div>
          <h2 className="text-lg font-semibold text-brown-800">{branch.name}</h2>
          <p className="font-mono text-xs text-brown-500">
            {branch.code} · {branch.coverageThanas.length} thanas
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatCard label="Hub Parcels" value={hub.length} icon={Package} />
        <StatCard label="At Hub Now" value={atHub} icon={Building2} accent="brown" />
        <StatCard label="To Dispatch" value={toDispatch} icon={Send} accent="amber" />
        <StatCard label="Pending Pickup" value={pendingPickup} icon={Inbox} accent="amber" />
        <StatCard label="Delivered" value={delivered.length} icon={CheckCircle2} />
        <StatCard label="COD Collected" value={formatBDT(codCollected)} icon={Wallet} accent="brown" />
      </div>

      <p className="text-xs text-brown-500">
        {hubRiders} delivery rider(s) at this hub.
      </p>

      <Card
        title="Recent Hub Parcels"
        action={
          <Link href="/branch/parcels" className="text-xs text-primary hover:underline">
            View all
          </Link>
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={recent}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/branch/parcels/${p.id}`)}
          emptyMessage="No parcels at this hub yet."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
