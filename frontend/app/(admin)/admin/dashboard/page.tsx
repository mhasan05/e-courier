"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Package, Users, Wallet, CheckCircle2, LifeBuoy, ChevronRight } from "lucide-react";
import StatCard from "@/components/ui/StatCard";
import Card from "@/components/ui/Card";
import StatusBadge from "@/components/ui/StatusBadge";
import Table, { type Column } from "@/components/ui/Table";
import ParcelTrendChart from "@/components/charts/ParcelTrendChart";
import StatusPieChart from "@/components/charts/StatusPieChart";
import { useParcels } from "@/lib/parcel-store";
import { useTickets, openTicketCount } from "@/lib/support-store";
import { useMerchants } from "@/lib/merchant-store";
import { dailyVolume, deliveryBreakdown } from "@/lib/analytics";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export default function AdminDashboardPage() {
  const router = useRouter();
  const allParcels = useParcels();
  const tickets = useTickets();
  const allMerchants = useMerchants();
  const totalParcels = allParcels.length;
  const activeMerchants = allMerchants.filter((m) => m.status === "active").length;
  const pendingCod = allMerchants.reduce((s, m) => s + m.codPending, 0);
  const deliveredToday = allParcels.filter((p) => p.status === "delivered").length;
  const openTickets = openTicketCount(tickets);
  const unreadTickets = tickets.filter((t) => t.unreadForAdmin).length;

  const trend = dailyVolume(allParcels);
  const breakdown = deliveryBreakdown(allParcels);

  const recent = [...allParcels]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, 5);

  const columns: Column<Parcel>[] = [
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => (
        <Link
          href={`/admin/parcels/${p.id}`}
          className="font-mono text-xs text-primary hover:underline"
        >
          {p.trackingId}
        </Link>
      ),
    },
    { key: "merchantName", header: "Merchant" },
    {
      key: "status",
      header: "Status",
      render: (p) => <StatusBadge kind="parcel" status={p.status} />,
    },
    { key: "createdAt", header: "Date", render: (p) => formatDate(p.createdAt) },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Total Parcels" value={totalParcels} icon={Package} />
        <StatCard label="Active Merchants" value={activeMerchants} icon={Users} accent="brown" />
        <StatCard label="Pending COD" value={formatBDT(pendingCod)} icon={Wallet} accent="amber" />
        <StatCard label="Delivered Today" value={deliveredToday} icon={CheckCircle2} />
      </div>

      <Link href="/admin/support" className="block">
        <div className="flex items-center justify-between rounded-xl border border-brown-100 bg-white p-4 shadow-card transition-colors hover:border-primary-200">
          <div className="flex items-center gap-3">
            <span className="relative flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary">
              <LifeBuoy className="h-5 w-5" />
              {unreadTickets > 0 && (
                <span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-bold text-white">
                  {unreadTickets > 9 ? "9+" : unreadTickets}
                </span>
              )}
            </span>
            <div>
              <p className="text-sm font-semibold text-brown-800">Support Tickets</p>
              <p className="text-xs text-brown-500">
                {openTickets} open
                {unreadTickets > 0 ? ` · ${unreadTickets} unread` : ""}
              </p>
            </div>
          </div>
          <ChevronRight className="h-5 w-5 text-brown-400" />
        </div>
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <Card title="Parcel Volume (Last 7 Days)" className="lg:col-span-2">
          <ParcelTrendChart data={trend} />
        </Card>
        <Card title="Delivery Breakdown">
          <StatusPieChart data={breakdown} />
        </Card>
      </div>

      <Card
        title="Recent Parcels"
        action={
          <Link href="/admin/parcels" className="text-xs text-primary hover:underline">
            View all
          </Link>
        }
        bodyClassName="p-0"
      >
        <Table
          columns={columns}
          data={recent}
          rowKey={(p) => p.id}
          onRowClick={(p) => router.push(`/admin/parcels/${p.id}`)}
          emptyMessage="No parcels yet."
          className="border-0 shadow-none"
        />
      </Card>
    </div>
  );
}
