"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Clock, CheckCircle2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import SearchInput from "@/components/ui/SearchInput";
import Select from "@/components/ui/Select";
import Table, { type Column } from "@/components/ui/Table";
import { useTickets, openTicketCount } from "@/lib/support-store";
import {
  SUPPORT_STATUS_META,
  SUPPORT_CATEGORY_META,
  SUPPORT_PRIORITY_META,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicket, SupportStatus } from "@/types";

const STATUS_FILTERS = [
  { value: "all", label: "All statuses" },
  ...(Object.keys(SUPPORT_STATUS_META) as SupportStatus[]).map((s) => ({
    value: s,
    label: SUPPORT_STATUS_META[s].label,
  })),
];

export default function AdminSupportPage() {
  const router = useRouter();
  const all = useTickets();
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<string>("all");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return all
      .filter((t) => (status === "all" ? true : t.status === status))
      .filter(
        (t) =>
          !q ||
          t.ref.toLowerCase().includes(q) ||
          t.subject.toLowerCase().includes(q) ||
          t.merchantName.toLowerCase().includes(q),
      )
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }, [all, query, status]);

  const openCount = openTicketCount(all);
  const unreadCount = all.filter((t) => t.unreadForAdmin).length;
  const resolvedCount = all.filter(
    (t) => t.status === "resolved" || t.status === "closed",
  ).length;

  const columns: Column<SupportTicket>[] = [
    {
      key: "ref",
      header: "Ticket",
      render: (t) => (
        <span className="flex items-center gap-2">
          {t.unreadForAdmin && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="New message" />
          )}
          <span className="font-mono text-xs text-brown-500">{t.ref}</span>
        </span>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-brown-800">{t.subject}</p>
          <p className="text-xs text-brown-500">{SUPPORT_CATEGORY_META[t.category]}</p>
        </div>
      ),
    },
    { key: "merchantName", header: "Merchant" },
    {
      key: "priority",
      header: "Priority",
      render: (t) => (
        <Badge className={SUPPORT_PRIORITY_META[t.priority].classes}>
          {SUPPORT_PRIORITY_META[t.priority].label}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <Badge className={SUPPORT_STATUS_META[t.status].classes}>
          {SUPPORT_STATUS_META[t.status].label}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Last Update",
      render: (t) => (
        <span className="text-xs text-brown-500">{formatDateTime(t.updatedAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">Support Tickets</h1>
        <p className="text-sm text-brown-500">Triage and respond to merchant tickets.</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard label="Open / In Progress" value={openCount} icon={Clock} accent="amber" />
        <StatCard label="Unread" value={unreadCount} icon={LifeBuoy} accent="primary" />
        <StatCard label="Resolved / Closed" value={resolvedCount} icon={CheckCircle2} accent="brown" />
      </div>

      <Card bodyClassName="p-0">
        <div className="flex flex-col gap-3 border-b border-brown-100 p-4 sm:flex-row sm:items-center">
          <SearchInput
            value={query}
            onChange={setQuery}
            placeholder="Search ref, subject, or merchant…"
            className="flex-1"
          />
          <Select
            value={status}
            onChange={(e) => setStatus(e.target.value)}
            options={STATUS_FILTERS}
            className="sm:w-44"
          />
        </div>
        <Table
          columns={columns}
          data={filtered}
          rowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/admin/support/${t.id}`)}
          emptyMessage="No tickets match."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
