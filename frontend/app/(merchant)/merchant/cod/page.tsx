"use client";

import { useMemo } from "react";
import { Wallet, CheckCircle2, Clock } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import StatusBadge from "@/components/ui/StatusBadge";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { useParcels, collectedCodOf } from "@/lib/parcel-store";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function MerchantCodPage() {
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useParcels();

  // Real COD activity — the merchant's delivered parcels that collected cash.
  const codParcels = useMemo(
    () =>
      all
        .filter(
          (p) =>
            p.merchantId === me.id &&
            (p.status === "delivered" || p.status === "partially_delivered") &&
            collectedCodOf(p) > 0,
        )
        .sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [all, me.id],
  );

  const columns: Column<Parcel>[] = [
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => <span className="font-mono text-xs text-brown-600">{p.trackingId}</span>,
    },
    { key: "recipientName", header: "Recipient" },
    {
      key: "collected",
      header: "COD Collected",
      render: (p) => formatBDT(collectedCodOf(p)),
    },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Total Collected" value={formatBDT(me.codCollected)} icon={Wallet} accent="brown" />
        <StatCard label="Total Disbursed" value={formatBDT(me.codDisbursed)} icon={CheckCircle2} />
        <StatCard label="Current Pending" value={formatBDT(me.codPending)} icon={Clock} accent="amber" />
      </div>

      <Card title="COD Collected on Deliveries" bodyClassName="p-0">
        <Table
          columns={columns}
          data={codParcels}
          rowKey={(p) => p.id}
          emptyMessage="No COD collected yet."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
