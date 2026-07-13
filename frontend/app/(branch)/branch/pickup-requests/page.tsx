"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Inbox, Users, Wallet } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import { useParcels } from "@/lib/parcel-store";
import { useMerchants } from "@/lib/merchant-store";
import { useBranchScope } from "@/hooks/useBranchScope";
import { formatBDT } from "@/lib/utils";

interface PickupRow {
  merchantId: number;
  merchantName: string;
  phone: string;
  pickupAddress: string;
  district: string;
  parcelCount: number;
  totalCod: number;
}

export default function BranchPickupRequestsPage() {
  const { branchId } = useBranchScope();
  const all = useParcels();
  const allMerchants = useMerchants();
  const merchantById = useMemo(
    () => new Map(allMerchants.map((m) => [m.id, m])),
    [allMerchants],
  );

  // Pending parcels this hub picks up (origin hub = this branch), per merchant.
  const rows = useMemo<PickupRow[]>(() => {
    if (branchId == null) return [];
    const groups = new Map<number, PickupRow>();
    for (const p of all) {
      if (p.status !== "pending" || p.ownerBranchId !== branchId) continue;
      const m = merchantById.get(p.merchantId);
      const r =
        groups.get(p.merchantId) ?? {
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          phone: m?.phone ?? "—",
          pickupAddress: m?.address ?? "—",
          district: m?.district ?? p.district,
          parcelCount: 0,
          totalCod: 0,
        };
      r.parcelCount += 1;
      r.totalCod += p.codAmount;
      groups.set(p.merchantId, r);
    }
    return Array.from(groups.values()).sort((a, b) => b.parcelCount - a.parcelCount);
  }, [all, branchId, merchantById]);

  const totalParcels = rows.reduce((s, r) => s + r.parcelCount, 0);
  const totalCod = rows.reduce((s, r) => s + r.totalCod, 0);

  const columns: Column<PickupRow>[] = [
    {
      key: "merchant",
      header: "Merchant",
      render: (r) => (
        <div>
          <p className="font-medium text-brown-800">{r.merchantName}</p>
          <p className="text-xs text-brown-500">{r.phone}</p>
        </div>
      ),
    },
    {
      key: "pickupAddress",
      header: "Pickup Address",
      render: (r) => (
        <div className="max-w-xs">
          <p className="text-sm text-brown-700">{r.pickupAddress}</p>
          <p className="text-xs text-brown-500">{r.district}</p>
        </div>
      ),
    },
    {
      key: "parcelCount",
      header: "Parcels",
      render: (r) => <Badge className="bg-brown-100 text-brown-700">{r.parcelCount}</Badge>,
    },
    {
      key: "totalCod",
      header: "Total COD",
      render: (r) => <span className="font-semibold text-brown-800">{formatBDT(r.totalCod)}</span>,
    },
    {
      key: "status",
      header: "Status",
      render: () => <Badge className="bg-warning-100 text-warning-700">Pending</Badge>,
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <Link href={`/branch/parcels?m=${r.merchantId}`} className="text-xs text-primary hover:underline">
          View parcels
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Merchants Awaiting Pickup" value={rows.length} icon={Users} accent="brown" />
        <StatCard label="Pending Parcels" value={totalParcels} icon={Inbox} accent="amber" />
        <StatCard label="Total COD" value={formatBDT(totalCod)} icon={Wallet} />
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={rows}
          rowKey={(r) => r.merchantId}
          emptyMessage="No pending pickups for this hub."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
