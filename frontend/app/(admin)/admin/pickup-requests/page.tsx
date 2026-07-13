"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Inbox, Users, Wallet } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import SearchInput from "@/components/ui/SearchInput";
import StatCard from "@/components/ui/StatCard";
import { useParcels } from "@/lib/parcel-store";
import { useMerchants } from "@/lib/merchant-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { formatBDT } from "@/lib/utils";

interface PickupRow {
  merchantId: number;
  merchantName: string;
  phone: string;
  pickupAddress: string;
  district: string;
  hubId?: number;
  parcelCount: number;
  totalCod: number;
}

export default function AdminPickupRequestsPage() {
  const allParcels = useParcels();
  const allMerchants = useMerchants();
  useBranches(); // subscribe so hub labels stay current
  const merchantById = useMemo(
    () => new Map(allMerchants.map((m) => [m.id, m])),
    [allMerchants],
  );
  const [search, setSearch] = useState("");

  // Group pending parcels (awaiting pickup) by merchant → one row each.
  const rows = useMemo<PickupRow[]>(() => {
    const groups = new Map<number, PickupRow>();
    for (const p of allParcels) {
      if (p.status !== "pending") continue;
      const m = merchantById.get(p.merchantId);
      const existing =
        groups.get(p.merchantId) ?? {
          merchantId: p.merchantId,
          merchantName: p.merchantName,
          phone: m?.phone ?? "—",
          pickupAddress: m?.address ?? "—",
          district: m?.district ?? p.district,
          hubId: p.ownerBranchId ?? m?.homeBranchId,
          parcelCount: 0,
          totalCod: 0,
        };
      existing.parcelCount += 1;
      existing.totalCod += p.codAmount;
      groups.set(p.merchantId, existing);
    }
    return Array.from(groups.values()).sort(
      (a, b) => b.parcelCount - a.parcelCount,
    );
  }, [allParcels, merchantById]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter(
      (r) =>
        r.merchantName.toLowerCase().includes(q) || r.phone.includes(q),
    );
  }, [rows, search]);

  const totalParcels = rows.reduce((s, r) => s + r.parcelCount, 0);
  const totalCod = rows.reduce((s, r) => s + r.totalCod, 0);

  const columns: Column<PickupRow>[] = [
    {
      key: "merchant",
      header: "Merchant",
      render: (r) => (
        <Link href={`/admin/merchants/${r.merchantId}`} className="hover:underline">
          <p className="font-medium text-brown-800">{r.merchantName}</p>
          <p className="text-xs text-brown-500">{r.phone}</p>
        </Link>
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
      key: "hub",
      header: "Pickup Hub",
      render: (r) => {
        const b = getBranchById(r.hubId);
        return b ? (
          <Badge className="bg-primary-50 text-primary-700">{b.code}</Badge>
        ) : (
          <span className="text-brown-400">—</span>
        );
      },
    },
    {
      key: "parcelCount",
      header: "Parcels",
      render: (r) => (
        <Badge className="bg-brown-100 text-brown-700">{r.parcelCount}</Badge>
      ),
    },
    {
      key: "totalCod",
      header: "Total COD",
      render: (r) => (
        <span className="font-semibold text-brown-800">{formatBDT(r.totalCod)}</span>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: () => (
        <Badge className="bg-warning-100 text-warning-700">Pending</Badge>
      ),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (r) => (
        <Link href={`/admin/merchants/${r.merchantId}`}>
          <Button size="sm" variant="outline">
            View
          </Button>
        </Link>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Merchants Awaiting Pickup" value={rows.length} icon={Users} accent="brown" />
        <StatCard label="Pending Parcels" value={totalParcels} icon={Inbox} accent="amber" />
        <StatCard label="Total COD to Collect" value={formatBDT(totalCod)} icon={Wallet} />
      </div>

      <div className="flex justify-end">
        <SearchInput
          value={search}
          onChange={setSearch}
          placeholder="Search merchant or phone…"
          className="w-full sm:w-72"
        />
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={filtered}
          rowKey={(r) => r.merchantId}
          emptyMessage="No pending pickup requests."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
