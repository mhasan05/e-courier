"use client";

import { useMemo, useState } from "react";
import { BarChart3, Package } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table, { type Column } from "@/components/ui/Table";
import ExportButton from "@/components/ui/ExportButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { FilterField } from "@/components/ui/FilterBar";
import {
  StatTile,
  CodSplit,
  BreakdownBars,
} from "@/components/reports/ReportBits";
import { useParcels, collectedCodOf } from "@/lib/parcel-store";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { successRate, codSummary, opBreakdown } from "@/lib/analytics";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function MerchantReportsPage() {
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useParcels();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState<{ from: string; to: string }>({
    from: "",
    to: "",
  });

  const mine = useMemo(
    () => all.filter((p) => p.merchantId === me.id),
    [all, me.id],
  );

  const filtered = useMemo(
    () =>
      mine.filter(
        (p) =>
          (!applied.from || p.createdAt >= applied.from) &&
          (!applied.to || p.createdAt <= applied.to),
      ),
    [mine, applied],
  );

  const op = useMemo(() => opBreakdown(filtered), [filtered]);
  const cod = useMemo(() => codSummary(filtered), [filtered]);
  const inProgress =
    filtered.length - op.delivered - op.returned - op.cancelled;

  const statusRows = useMemo(
    () =>
      (Object.keys(PARCEL_STATUS_META) as Parcel["status"][])
        .map((s) => ({
          status: s,
          count: filtered.filter((p) => p.status === s).length,
        }))
        .filter((r) => r.count > 0)
        .sort((a, b) => b.count - a.count),
    [filtered],
  );

  const columns: Column<Parcel>[] = [
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => <span className="font-mono text-xs">{p.trackingId}</span>,
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
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">
          Delivery Report
        </h1>
        <p className="text-xs text-brown-500">
          How your parcels are performing and how much COD is on the way to you.
        </p>
      </div>

      <Card>
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="From">
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="h-10 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </FilterField>
          <FilterField label="To">
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="h-10 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
            />
          </FilterField>
          <Button onClick={() => setApplied({ from, to })}>
            <BarChart3 className="h-4 w-4" /> Generate
          </Button>
          {(applied.from || applied.to) && (
            <Button
              variant="secondary"
              onClick={() => {
                setFrom("");
                setTo("");
                setApplied({ from: "", to: "" });
              }}
            >
              Clear
            </Button>
          )}
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-5">
        <StatTile label="Total parcels" value={filtered.length} />
        <StatTile label="In progress" value={inProgress} tone="warning" />
        <StatTile label="Delivered" value={op.delivered} tone="success" />
        <StatTile label="Returned" value={op.returned} tone="danger" />
        <StatTile
          label="Success rate"
          value={`${successRate(filtered)}%`}
          tone="primary"
          hint="of finished parcels"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <div className="space-y-1">
          <CodSplit collected={cod.collected} pending={cod.pending} />
          <p className="px-1 text-xs text-brown-400">
            <b className="text-success-600">Collected</b> is COD received on
            delivered parcels (remitted to you).{" "}
            <b className="text-warning-600">Still to collect</b> is COD on
            parcels still in progress.
          </p>
        </div>
        <Card title="Status breakdown">
          <BreakdownBars
            rows={statusRows.map((r) => ({
              label: PARCEL_STATUS_META[r.status].label,
              count: r.count,
            }))}
          />
        </Card>
      </div>

      <Card
        title={
          <span className="inline-flex items-center gap-1.5">
            <Package className="h-4 w-4" /> Parcels ({filtered.length})
          </span>
        }
        action={
          <ExportButton
            data={filtered.map((p) => ({
              trackingId: p.trackingId,
              recipient: p.recipientName,
              district: p.district,
              cod: p.codAmount,
              collected: collectedCodOf(p),
              status: PARCEL_STATUS_META[p.status].label,
              date: p.createdAt,
            }))}
            filename="my-parcel-report.csv"
          />
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={filtered}
          rowKey={(p) => p.id}
          emptyMessage="No parcels in the selected range."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
