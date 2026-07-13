"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronRight } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Tabs from "@/components/ui/Tabs";
import SearchInput from "@/components/ui/SearchInput";
import StatusBadge from "@/components/ui/StatusBadge";
import Pagination from "@/components/ui/Pagination";
import Badge from "@/components/ui/Badge";
import { useMerchants } from "@/lib/merchant-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { formatDate, merchantCode } from "@/lib/utils";
import type { Merchant, MerchantStatus } from "@/types";

const PAGE_SIZE = 10;
type TabValue = "all" | MerchantStatus;

export default function AdminMerchantsPage() {
  const router = useRouter();
  const rows = useMerchants();
  useBranches();
  const [tab, setTab] = useState<TabValue>("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const counts = useMemo(
    () => ({
      all: rows.length,
      pending: rows.filter((m) => m.status === "pending").length,
      active: rows.filter((m) => m.status === "active").length,
      suspended: rows.filter((m) => m.status === "suspended").length,
    }),
    [rows],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows
      .filter((m) => {
        if (tab !== "all" && m.status !== tab) return false;
        if (!q) return true;
        const code = merchantCode(m.id).toLowerCase(); // e.g. "mch-0001"
        return (
          code.includes(q) ||
          String(m.id) === q ||
          m.name.toLowerCase().includes(q) ||
          m.shopName.toLowerCase().includes(q) ||
          m.phone.includes(q)
        );
      })
      // Most recently joined merchants first.
      .sort((a, b) => b.joinDate.localeCompare(a.joinDate));
  }, [rows, tab, search]);

  const pageRows = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const columns: Column<Merchant>[] = [
    {
      key: "code",
      header: "Merchant ID",
      render: (m) => (
        <span className="font-mono text-xs text-brown-600">
          {merchantCode(m.id)}
        </span>
      ),
    },
    {
      key: "name",
      header: "Merchant",
      render: (m) => (
        <div>
          <p className="font-medium text-brown-800">{m.name}</p>
          <p className="text-xs text-brown-500">{m.shopName}</p>
        </div>
      ),
    },
    { key: "phone", header: "Phone" },
    {
      key: "hub",
      header: "Managing Hub",
      render: (m) => {
        const b = getBranchById(m.homeBranchId);
        return b ? (
          <Badge className="bg-primary-50 text-primary-700">{b.code}</Badge>
        ) : (
          <span className="text-brown-400">Unassigned</span>
        );
      },
    },
    { key: "joinDate", header: "Joined", render: (m) => formatDate(m.joinDate) },
    {
      key: "status",
      header: "Status",
      render: (m) => <StatusBadge kind="merchant" status={m.status} />,
    },
    {
      key: "go",
      header: "",
      className: "w-10 text-right",
      render: () => <ChevronRight className="ml-auto h-4 w-4 text-brown-400" />,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          value={tab}
          onChange={(v) => {
            setTab(v as TabValue);
            setPage(1);
          }}
          tabs={[
            { label: "All", value: "all", count: counts.all },
            { label: "Pending", value: "pending", count: counts.pending },
            { label: "Active", value: "active", count: counts.active },
            { label: "Suspended", value: "suspended", count: counts.suspended },
          ]}
        />
        <SearchInput
          value={search}
          onChange={(v) => {
            setSearch(v);
            setPage(1);
          }}
          placeholder="Search ID, name, shop, phone…"
          className="w-full sm:w-72"
        />
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={pageRows}
          rowKey={(m) => m.id}
          emptyMessage="No merchants match your filters."
          onRowClick={(m) => router.push(`/admin/merchants/${m.id}`)}
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
