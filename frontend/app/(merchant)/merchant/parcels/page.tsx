"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye } from "lucide-react";
import Card from "@/components/ui/Card";
import FilterBar, { FilterField } from "@/components/ui/FilterBar";
import SearchInput from "@/components/ui/SearchInput";
import Tabs from "@/components/ui/Tabs";
import Table, { type Column } from "@/components/ui/Table";
import StatusBadge from "@/components/ui/StatusBadge";
import Button from "@/components/ui/Button";
import Pagination from "@/components/ui/Pagination";
import ExportButton from "@/components/ui/ExportButton";
import { useParcels } from "@/lib/parcel-store";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { PARCEL_STATUS_META } from "@/lib/constants";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel, ParcelStatus } from "@/types";

const PAGE_SIZE = 8;

// Status tabs map to one or more underlying statuses.
const TABS: { label: string; value: string; match: (s: ParcelStatus) => boolean }[] = [
  { label: "All", value: "all", match: () => true },
  { label: "Pending", value: "pending", match: (s) => s === "pending" },
  {
    label: "In Transit",
    value: "transit",
    match: (s) =>
      ["picked_up", "in_transit", "out_for_delivery"].includes(s),
  },
  { label: "Delivered", value: "delivered", match: (s) => s === "delivered" },
  {
    label: "Returned",
    value: "returned",
    match: (s) => ["returned", "return_in_transit"].includes(s),
  },
  { label: "Cancelled", value: "cancelled", match: (s) => s === "cancelled" },
];

export default function MerchantParcelsPage() {
  const router = useRouter();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useParcels();
  const [tab, setTab] = useState("all");
  const [search, setSearch] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [page, setPage] = useState(1);

  const mine = useMemo(
    () => all.filter((p) => p.merchantId === me.id),
    [all, me.id],
  );

  const filtered = useMemo(() => {
    const matcher = TABS.find((t) => t.value === tab)?.match ?? (() => true);
    const q = search.trim().toLowerCase();
    return mine.filter((p) => {
      if (!matcher(p.status)) return false;
      if (q && !p.trackingId.toLowerCase().includes(q)) return false;
      if (dateFrom && p.createdAt < dateFrom) return false;
      if (dateTo && p.createdAt > dateTo) return false;
      return true;
    });
  }, [mine, tab, search, dateFrom, dateTo]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  const resetPage = () => setPage(1);

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
    { key: "district", header: "District" },
    {
      key: "deliveryType",
      header: "Type",
      render: (p) => <span className="capitalize">{p.deliveryType}</span>,
    },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Created", render: (p) => formatDate(p.createdAt) },
    {
      key: "actions",
      header: "Actions",
      className: "text-right",
      render: (p) => (
        <div className="flex justify-end gap-1.5">
          <Link href={`/merchant/parcels/${p.id}`}>
            <Button size="sm" variant="ghost">
              <Eye className="h-4 w-4" /> View
            </Button>
          </Link>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <FilterBar>
        <FilterField label="Search">
          <SearchInput
            value={search}
            onChange={(v) => { setSearch(v); resetPage(); }}
            placeholder="Tracking ID"
            className="w-52"
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
              recipient: p.recipientName,
              district: p.district,
              type: p.deliveryType,
              cod: p.codAmount,
              status: PARCEL_STATUS_META[p.status].label,
              created: p.createdAt,
            }))}
            filename="my-parcels.csv"
          />
        </div>
      </FilterBar>

      <Tabs
        value={tab}
        onChange={(v) => { setTab(v); resetPage(); }}
        tabs={TABS.map((t) => ({
          label: t.label,
          value: t.value,
          count: mine.filter((p) => t.match(p.status)).length,
        }))}
      />

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={pageRows}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/merchant/parcels/${p.id}`)}
          emptyMessage="No parcels match your filters."
          className="border-0 shadow-none"
        />
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
