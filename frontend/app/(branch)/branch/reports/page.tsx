"use client";

import { useMemo, useState } from "react";
import { BarChart3, Package, Users } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Table, { type Column } from "@/components/ui/Table";
import ExportButton from "@/components/ui/ExportButton";
import StatusBadge from "@/components/ui/StatusBadge";
import { FilterField } from "@/components/ui/FilterBar";
import PanelLoading from "@/components/layout/PanelLoading";
import {
  StatTile,
  PipelineStrip,
  CodSplit,
  BreakdownBars,
} from "@/components/reports/ReportBits";
import { useParcels, useParcelsReady, collectedCodOf } from "@/lib/parcel-store";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import { getBranchById } from "@/lib/branch-store";
import { useBranchScope, parcelInBranch } from "@/hooks/useBranchScope";
import { successRate, codSummary, opBreakdown } from "@/lib/analytics";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function BranchReportsPage() {
  const { branchId } = useBranchScope();
  const all = useParcels();
  const ready = useParcelsReady();
  const riders = useDeliveryMen();
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ from: "", to: "" });

  const hub = useMemo(
    () => (branchId == null ? [] : all.filter((p) => parcelInBranch(p, branchId))),
    [all, branchId],
  );

  const filtered = useMemo(
    () =>
      hub.filter(
        (p) =>
          (!applied.from || p.createdAt >= applied.from) &&
          (!applied.to || p.createdAt <= applied.to),
      ),
    [hub, applied],
  );

  const op = useMemo(() => opBreakdown(filtered), [filtered]);
  const cod = useMemo(() => codSummary(filtered), [filtered]);

  // Rider performance — only riders that belong to this hub, over the filtered set.
  const riderRows = useMemo(() => {
    const mine = riders.filter((r) => r.branchId === branchId);
    return mine
      .map((r) => {
        const assigned = filtered.filter((p) => p.deliveryManId === r.id);
        const delivered = assigned.filter((p) => p.status === "delivered");
        const failed = assigned.filter((p) =>
          ["returned", "return_in_transit"].includes(p.status),
        ).length;
        return {
          id: r.id,
          name: r.name,
          assigned: assigned.length,
          delivered: delivered.length,
          failed,
          cod: assigned.reduce((s, p) => s + collectedCodOf(p), 0),
        };
      })
      .filter((r) => r.assigned > 0)
      .sort((a, b) => b.delivered - a.delivered);
  }, [riders, branchId, filtered]);

  const hubName = branchId != null ? getBranchById(branchId)?.name : undefined;

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
    { key: "merchantName", header: "Merchant" },
    { key: "recipientName", header: "Recipient" },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  if (!ready) return <PanelLoading />;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">
          {hubName ? `${hubName} — Hub Report` : "Hub Report"}
        </h1>
        <p className="text-xs text-brown-500">
          Everything currently involving your hub, plus what your riders have done.
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

      {/* Headline KPIs */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <StatTile label="Total handled" value={filtered.length} />
        <StatTile
          label="Delivered"
          value={op.delivered}
          tone="success"
        />
        <StatTile label="Returned" value={op.returned} tone="danger" />
        <StatTile
          label="Success rate"
          value={`${successRate(filtered)}%`}
          tone="primary"
          hint="of finished parcels"
        />
      </div>

      {/* Operational pipeline — where parcels sit right now */}
      <Card title="Where your parcels are now">
        <PipelineStrip b={op} />
      </Card>

      {/* COD money */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <CodSplit collected={cod.collected} pending={cod.pending} />
        <Card title="Status breakdown">
          <BreakdownBars
            rows={statusRows.map((r) => ({
              label: PARCEL_STATUS_META[r.status].label,
              count: r.count,
            }))}
          />
        </Card>
      </div>

      {/* Rider performance */}
      <Card
        title={
          <span className="inline-flex items-center gap-1.5">
            <Users className="h-4 w-4" /> Rider performance
          </span>
        }
        bodyClassName="p-0"
      >
        <Table
          columns={[
            { key: "name", header: "Rider" },
            { key: "assigned", header: "Assigned" },
            {
              key: "delivered",
              header: "Delivered",
              render: (r) => (
                <span className="font-medium text-success-600">{r.delivered}</span>
              ),
            },
            {
              key: "failed",
              header: "Returned",
              render: (r) => (
                <span className="text-danger-600">{r.failed}</span>
              ),
            },
            {
              key: "cod",
              header: "COD collected",
              render: (r) => formatBDT(r.cod),
            },
          ]}
          data={riderRows}
          rowKey={(r) => r.id}
          emptyMessage="No rider activity in this range."
          className="border-0 shadow-none"
        />
      </Card>

      {/* Full parcel list + export */}
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
              merchant: p.merchantName,
              recipient: p.recipientName,
              cod: p.codAmount,
              collected: collectedCodOf(p),
              status: PARCEL_STATUS_META[p.status].label,
              date: p.createdAt,
            }))}
            filename="hub-report.csv"
          />
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={filtered}
          rowKey={(p) => p.id}
          emptyMessage="No parcels in range."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
