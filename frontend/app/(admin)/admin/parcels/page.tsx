"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Card from "@/components/ui/Card";
import FilterBar, { FilterField } from "@/components/ui/FilterBar";
import Select from "@/components/ui/Select";
import SearchInput from "@/components/ui/SearchInput";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import ExportButton from "@/components/ui/ExportButton";
import { useToast } from "@/components/ui/Toast";
import { useParcels, setParcelStatus } from "@/lib/parcel-store";
import { useMerchants } from "@/lib/merchant-store";
import { useZones } from "@/lib/zone-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate, cn } from "@/lib/utils";
import type { ParcelStatus } from "@/types";

const PAGE_SIZE = 8;
const STATUS_OPTIONS = (Object.keys(PARCEL_STATUS_META) as ParcelStatus[]).map(
  (s) => ({ value: s, label: PARCEL_STATUS_META[s].label }),
);

export default function AdminParcelsPage() {
  const toast = useToast();
  const router = useRouter();
  const rows = useParcels();
  const allMerchants = useMerchants();
  const zoneList = useZones();
  const branches = useBranches();
  const [status, setStatus] = useState("");
  const [merchantId, setMerchantId] = useState("");
  const [zone, setZone] = useState("");
  const [hubId, setHubId] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ParcelStatus | "">("");

  const merchantOptions = allMerchants.map((m) => ({
    value: String(m.id),
    label: m.shopName,
  }));
  const zoneOptions = zoneList.map((z) => ({
    value: z.name,
    label: z.name,
  }));
  const hubOptions = branches.map((b) => ({
    value: String(b.id),
    label: b.name,
  }));

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((p) => {
      if (status && p.status !== status) return false;
      if (merchantId && p.merchantId !== Number(merchantId)) return false;
      if (zone && p.zone !== zone) return false;
      // Hub filter = parcels currently handled by that hub (its present custody).
      if (hubId && p.currentBranchId !== Number(hubId)) return false;
      if (dateFrom && p.createdAt < dateFrom) return false;
      if (dateTo && p.createdAt > dateTo) return false;
      if (q && !p.trackingId.toLowerCase().includes(q) && !p.recipientName.toLowerCase().includes(q))
        return false;
      return true;
    });
  }, [rows, status, merchantId, zone, hubId, dateFrom, dateTo, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const allOnPageSelected =
    pageRows.length > 0 && pageRows.every((p) => selected.has(p.id));

  const toggleRow = (id: number) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleAllOnPage = () => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (allOnPageSelected) pageRows.forEach((p) => next.delete(p.id));
      else pageRows.forEach((p) => next.add(p.id));
      return next;
    });
  };

  const applyBulk = () => {
    if (!bulkStatus || selected.size === 0) return;
    // Route through the shared store so the change propagates to the parcel
    // detail, merchant view, and public tracker — and logs each transition.
    selected.forEach((id) =>
      setParcelStatus(id, bulkStatus, "Bulk status update", "Admin"),
    );
    toast.success(
      `Updated ${selected.size} parcel(s) → ${PARCEL_STATUS_META[bulkStatus].label}`,
    );
    setSelected(new Set());
    setBulkStatus("");
  };

  const resetPage = () => setPage(1);

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Search">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); resetPage(); }}
            placeholder="Tracking ID / recipient"
            className="w-56"
          />
        </FilterField>
        <FilterField label="Status">
          <Select
            value={status}
            onChange={(e) => { setStatus(e.target.value); resetPage(); }}
            placeholder="All statuses"
            options={STATUS_OPTIONS}
            className="w-44"
          />
        </FilterField>
        <FilterField label="Merchant">
          <Select
            value={merchantId}
            onChange={(e) => { setMerchantId(e.target.value); resetPage(); }}
            placeholder="All merchants"
            options={merchantOptions}
            className="w-44"
          />
        </FilterField>
        <FilterField label="Zone">
          <Select
            value={zone}
            onChange={(e) => { setZone(e.target.value); resetPage(); }}
            placeholder="All zones"
            options={zoneOptions}
            className="w-40"
          />
        </FilterField>
        <FilterField label="Hub">
          <Select
            value={hubId}
            onChange={(e) => { setHubId(e.target.value); resetPage(); }}
            placeholder="All hubs"
            options={hubOptions}
            className="w-44"
          />
        </FilterField>
        <FilterField label="From">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => { setDateFrom(e.target.value); resetPage(); }}
            className="h-10 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </FilterField>
        <FilterField label="To">
          <input
            type="date"
            value={dateTo}
            onChange={(e) => { setDateTo(e.target.value); resetPage(); }}
            className="h-10 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </FilterField>
        <div className="ml-auto self-end">
          <ExportButton
            data={filtered.map((p) => ({
              trackingId: p.trackingId,
              merchant: p.merchantName,
              recipient: p.recipientName,
              district: p.district,
              zone: p.zone,
              cod: p.codAmount,
              status: PARCEL_STATUS_META[p.status].label,
              date: p.createdAt,
            }))}
            filename="parcels.csv"
          />
        </div>
      </FilterBar>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-xl border border-primary-200 bg-primary-50 px-4 py-3">
          <span className="text-sm font-medium text-primary-700">
            {selected.size} selected
          </span>
          <Select
            value={bulkStatus}
            onChange={(e) => setBulkStatus(e.target.value as ParcelStatus)}
            placeholder="Update status to…"
            options={STATUS_OPTIONS}
            className="w-52"
          />
          <Button size="sm" onClick={applyBulk} disabled={!bulkStatus}>
            Apply
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setSelected(new Set())}>
            Clear
          </Button>
        </div>
      )}

      <Card bodyClassName="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-100 bg-brown-50/60 text-xs font-semibold uppercase tracking-wide text-brown-500">
                <th className="px-4 py-3">
                  <input
                    type="checkbox"
                    checked={allOnPageSelected}
                    onChange={toggleAllOnPage}
                    className="h-4 w-4 accent-primary"
                    aria-label="Select all on page"
                  />
                </th>
                <th className="px-4 py-3">Tracking ID</th>
                <th className="px-4 py-3">Recipient</th>
                <th className="px-4 py-3">Merchant</th>
                <th className="px-4 py-3">Location</th>
                <th className="px-4 py-3">Zone</th>
                <th className="px-4 py-3">COD</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Date</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-brown-500">
                    No parcels match your filters.
                  </td>
                </tr>
              ) : (
                pageRows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={() => router.push(`/admin/parcels/${p.id}`)}
                    className={cn(
                      "cursor-pointer border-b border-brown-50 last:border-0 hover:bg-canvas/60",
                      selected.has(p.id) && "bg-primary-50/50",
                    )}
                  >
                    <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={selected.has(p.id)}
                        onChange={() => toggleRow(p.id)}
                        className="h-4 w-4 accent-primary"
                        aria-label={`Select ${p.trackingId}`}
                      />
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-mono text-xs text-primary">
                        {p.trackingId}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-brown-700">{p.recipientName}</td>
                    <td className="px-4 py-3 text-brown-700">{p.merchantName}</td>
                    <td className="px-4 py-3 text-brown-700">
                      {getBranchById(p.currentBranchId)?.name ?? "—"}
                      {p.status === "in_transit" && (
                        <span className="ml-1 text-xs text-brown-400">(in transit)</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-brown-700">{p.zone}</td>
                    <td className="px-4 py-3 text-brown-700">{formatBDT(p.codAmount)}</td>
                    <td className="px-4 py-3">
                      <StatusBadge kind="parcel" status={p.status} />
                    </td>
                    <td className="px-4 py-3 text-brown-700">{formatDate(p.createdAt)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="px-4">
          <Pagination
            page={page}
            pageSize={PAGE_SIZE}
            total={filtered.length}
            onPageChange={setPage}
          />
        </div>
      </Card>
    </div>
  );
}
