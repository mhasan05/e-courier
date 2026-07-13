"use client";

import { useMemo, useState } from "react";
import { BarChart3 } from "lucide-react";
import Card from "@/components/ui/Card";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import Table, { type Column } from "@/components/ui/Table";
import ExportButton from "@/components/ui/ExportButton";
import { FilterField } from "@/components/ui/FilterBar";
import {
  StatTile,
  PipelineStrip,
  CodSplit,
} from "@/components/reports/ReportBits";
import { useParcels } from "@/lib/parcel-store";
import { useBranches } from "@/lib/branch-store";
import { useMerchants } from "@/lib/merchant-store";
import { useZones } from "@/lib/zone-store";
import { parcelInBranch } from "@/hooks/useBranchScope";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { successRate, codSummary, opBreakdown } from "@/lib/analytics";
import { formatBDT } from "@/lib/utils";

type ReportType = "parcels" | "merchants" | "cod" | "branch";

export default function AdminReportsPage() {
  const allParcels = useParcels();
  const branches = useBranches();
  const allMerchants = useMerchants();
  const allZones = useZones();
  const [type, setType] = useState<ReportType>("parcels");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  // The committed query that the table reflects (set on "Generate").
  const [report, setReport] = useState<{
    type: ReportType;
    rows: Record<string, unknown>[];
  } | null>(null);

  const inRange = (date: string) =>
    (!from || date >= from) && (!to || date <= to);

  const generate = () => {
    if (type === "parcels") {
      const rows = allParcels
        .filter((p) => inRange(p.createdAt))
        .map((p) => ({
          trackingId: p.trackingId,
          merchant: p.merchantName,
          recipient: p.recipientName,
          zone: p.zone,
          cod: p.codAmount,
          status: PARCEL_STATUS_META[p.status].label,
          date: p.createdAt,
        }));
      setReport({ type, rows });
    } else if (type === "merchants") {
      const rows = allMerchants.map((m) => {
        const mp = allParcels.filter((p) => p.merchantId === m.id);
        return {
          merchant: m.shopName,
          owner: m.name,
          totalParcels: mp.length,
          delivered: mp.filter((p) => p.status === "delivered").length,
          returned: mp.filter((p) => p.status === "returned").length,
          successRate: `${successRate(mp)}%`,
          codPending: m.codPending,
        };
      });
      setReport({ type, rows });
    } else if (type === "branch") {
      const rows = branches.map((b) => {
        const bp = allParcels.filter((p) => parcelInBranch(p, b.id) && inRange(p.createdAt));
        const deliveredHere = allParcels.filter(
          (p) => p.ownerBranchId === b.id && p.status === "delivered" && inRange(p.createdAt),
        );
        return {
          hub: `${b.name} (${b.code})`,
          totalParcels: bp.length,
          delivered: bp.filter((p) => p.status === "delivered").length,
          returned: bp.filter((p) => p.status === "returned").length,
          successRate: `${successRate(bp)}%`,
          codCollected: deliveredHere.reduce((s, p) => s + p.codAmount, 0),
        };
      });
      setReport({ type, rows });
    } else {
      const rows = allZones.map((z) => {
        const zp = allParcels.filter((p) => p.zone === z.name && inRange(p.createdAt));
        return {
          zone: z.name,
          totalParcels: zp.length,
          delivered: zp.filter((p) => p.status === "delivered").length,
          revenue: zp.reduce((s, p) => s + p.totalCharge, 0),
        };
      });
      setReport({ type, rows });
    }
  };

  const columnsFor = (t: ReportType): Column<Record<string, unknown>>[] => {
    if (t === "parcels")
      return [
        { key: "trackingId", header: "Tracking ID", render: (r) => (
          <span className="font-mono text-xs">{String(r.trackingId)}</span>
        ) },
        { key: "merchant", header: "Merchant" },
        { key: "recipient", header: "Recipient" },
        { key: "zone", header: "Zone" },
        { key: "cod", header: "COD", render: (r) => formatBDT(Number(r.cod)) },
        { key: "status", header: "Status" },
        { key: "date", header: "Date" },
      ];
    if (t === "merchants")
      return [
        { key: "merchant", header: "Merchant" },
        { key: "totalParcels", header: "Parcels" },
        { key: "delivered", header: "Delivered" },
        { key: "returned", header: "Returned" },
        { key: "successRate", header: "Success" },
        { key: "codPending", header: "COD Pending", render: (r) => formatBDT(Number(r.codPending)) },
      ];
    if (t === "branch")
      return [
        { key: "hub", header: "Hub" },
        { key: "totalParcels", header: "Parcels" },
        { key: "delivered", header: "Delivered" },
        { key: "returned", header: "Returned" },
        { key: "successRate", header: "Success" },
        { key: "codCollected", header: "COD Collected", render: (r) => formatBDT(Number(r.codCollected)) },
      ];
    return [
      { key: "zone", header: "Zone" },
      { key: "totalParcels", header: "Parcels" },
      { key: "delivered", header: "Delivered" },
      { key: "revenue", header: "Revenue", render: (r) => formatBDT(Number(r.revenue)) },
    ];
  };

  const system = useMemo(() => {
    const op = opBreakdown(allParcels);
    const cod = codSummary(allParcels);
    return {
      op,
      cod,
      total: allParcels.length,
      success: successRate(allParcels),
      activeMerchants: allMerchants.filter((m) => m.status === "active").length,
      hubs: branches.length,
    };
  }, [allParcels, allMerchants, branches]);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">
          Network Overview
        </h1>
        <p className="text-xs text-brown-500">
          Live snapshot across every hub, then build a detailed report below.
        </p>
      </div>

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-6">
        <StatTile label="Total parcels" value={system.total} />
        <StatTile label="Delivered" value={system.op.delivered} tone="success" />
        <StatTile label="Returned" value={system.op.returned} tone="danger" />
        <StatTile
          label="Success rate"
          value={`${system.success}%`}
          tone="primary"
        />
        <StatTile label="Active merchants" value={system.activeMerchants} />
        <StatTile label="Hubs" value={system.hubs} />
      </div>

      <Card title="Network pipeline — where every parcel sits now">
        <PipelineStrip b={system.op} />
      </Card>

      <CodSplit collected={system.cod.collected} pending={system.cod.pending} />

      <Card title="Generate Report">
        <div className="flex flex-wrap items-end gap-3">
          <FilterField label="Report type">
            <Select
              value={type}
              onChange={(e) => setType(e.target.value as ReportType)}
              options={[
                { value: "parcels", label: "Parcel Report" },
                { value: "merchants", label: "Merchant Report" },
                { value: "branch", label: "Hub Report" },
                { value: "cod", label: "COD / Zone Report" },
              ]}
              className="w-52"
            />
          </FilterField>
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
          <Button onClick={generate}>
            <BarChart3 className="h-4 w-4" /> Generate
          </Button>
        </div>
      </Card>

      {report && (
        <Card
          title={`Results (${report.rows.length})`}
          action={
            <ExportButton
              data={report.rows}
              filename={`${report.type}-report.csv`}
            />
          }
          bodyClassName="p-0"
        >
          <Table
            columns={columnsFor(report.type)}
            data={report.rows}
            rowKey={(r) => JSON.stringify(r)}
            emptyMessage="No data for the selected range."
            className="border-0 shadow-none"
          />
        </Card>
      )}

      {!report && (
        <p className="text-sm text-brown-500">
          Choose a report type and date range, then click Generate.
        </p>
      )}
    </div>
  );
}
