"use client";

import { useEffect } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, User, Tag, Package, Clock } from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import PanelLoading from "@/components/layout/PanelLoading";
import TicketThread from "@/components/support/TicketThread";
import { useAuth } from "@/hooks/useAuth";
import { useHydrated } from "@/hooks/useHydrated";
import {
  useTickets,
  useTicketsReady,
  setTicketStatus,
  setTicketPriority,
  markTicketRead,
} from "@/lib/support-store";
import { useParcels } from "@/lib/parcel-store";
import {
  SUPPORT_STATUS_META,
  SUPPORT_CATEGORY_META,
  SUPPORT_PRIORITY_META,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { SupportStatus, SupportPriority } from "@/types";

const STATUS_OPTIONS = (Object.keys(SUPPORT_STATUS_META) as SupportStatus[]).map(
  (s) => ({ value: s, label: SUPPORT_STATUS_META[s].label }),
);
const PRIORITY_OPTIONS = (Object.keys(SUPPORT_PRIORITY_META) as SupportPriority[]).map(
  (p) => ({ value: p, label: SUPPORT_PRIORITY_META[p].label }),
);

export default function AdminTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const toast = useToast();
  const { name } = useAuth();
  const hydrated = useHydrated();
  const ready = useTicketsReady();
  const all = useTickets();
  const parcels = useParcels();
  const ticket = all.find((t) => t.id === Number(params.id));

  useEffect(() => {
    if (ticket?.unreadForAdmin) markTicketRead(ticket.id, "admin");
  }, [ticket?.id, ticket?.unreadForAdmin]);

  // Wait for hydration AND the initial API fetch to settle before judging
  // existence — otherwise a valid ticket 404s while the store is still loading.
  if (!hydrated || !ready) return <PanelLoading />;
  if (!ticket) notFound();

  const relatedParcel = ticket.trackingId
    ? parcels.find((p) => p.trackingId === ticket.trackingId)
    : undefined;

  const changeStatus = (s: SupportStatus) => {
    setTicketStatus(ticket.id, s);
    toast.success(`Status set to ${SUPPORT_STATUS_META[s].label}`);
  };
  const changePriority = (p: SupportPriority) => {
    setTicketPriority(ticket.id, p);
    toast.success(`Priority set to ${SUPPORT_PRIORITY_META[p].label}`);
  };

  return (
    <div className="space-y-4">
      <Link
        href="/admin/support"
        className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <Card>
            <p className="font-mono text-xs text-brown-500">{ticket.ref}</p>
            <h1 className="text-lg font-semibold text-brown-800">{ticket.subject}</h1>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <Badge className={SUPPORT_STATUS_META[ticket.status].classes}>
                {SUPPORT_STATUS_META[ticket.status].label}
              </Badge>
              <Badge className={SUPPORT_PRIORITY_META[ticket.priority].classes}>
                {SUPPORT_PRIORITY_META[ticket.priority].label} priority
              </Badge>
              <span className="inline-flex items-center gap-1 text-xs text-brown-500">
                <Tag className="h-3.5 w-3.5" /> {SUPPORT_CATEGORY_META[ticket.category]}
              </span>
            </div>
          </Card>

          <Card title="Conversation">
            <TicketThread ticket={ticket} side="admin" senderName={name || "System Admin"} />
          </Card>
        </div>

        <div className="space-y-4">
          <Card title="Manage">
            <div className="space-y-3">
              <Select
                label="Status"
                value={ticket.status}
                onChange={(e) => changeStatus(e.target.value as SupportStatus)}
                options={STATUS_OPTIONS}
              />
              <Select
                label="Priority"
                value={ticket.priority}
                onChange={(e) => changePriority(e.target.value as SupportPriority)}
                options={PRIORITY_OPTIONS}
              />
            </div>
          </Card>

          <Card title="Details">
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-brown-400" />
                <dt className="text-brown-500">Merchant</dt>
                <dd className="ml-auto font-medium text-brown-700">{ticket.merchantName}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brown-400" />
                <dt className="text-brown-500">Opened</dt>
                <dd className="ml-auto text-brown-600">{formatDateTime(ticket.createdAt)}</dd>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-brown-400" />
                <dt className="text-brown-500">Updated</dt>
                <dd className="ml-auto text-brown-600">{formatDateTime(ticket.updatedAt)}</dd>
              </div>
              {ticket.trackingId && (
                <div className="flex items-center gap-2 border-t border-brown-100 pt-2.5">
                  <Package className="h-4 w-4 text-brown-400" />
                  <dt className="text-brown-500">Parcel</dt>
                  <dd className="ml-auto">
                    {relatedParcel ? (
                      <Link
                        href={`/admin/parcels/${relatedParcel.id}`}
                        className="font-mono text-primary hover:underline"
                      >
                        {ticket.trackingId}
                      </Link>
                    ) : (
                      <span className="font-mono text-brown-500">{ticket.trackingId}</span>
                    )}
                  </dd>
                </div>
              )}
            </dl>
          </Card>
        </div>
      </div>
    </div>
  );
}
