"use client";

import { useEffect } from "react";
import Link from "next/link";
import { ArrowLeft, CheckCircle2, RotateCcw, Tag } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Badge from "@/components/ui/Badge";
import PanelLoading from "@/components/layout/PanelLoading";
import { useToast } from "@/components/ui/Toast";
import TicketThread from "@/components/support/TicketThread";
import { requireOwned } from "@/lib/scope";
import { useAuth } from "@/hooks/useAuth";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { useTickets, setTicketStatus, markTicketRead } from "@/lib/support-store";
import {
  SUPPORT_STATUS_META,
  SUPPORT_CATEGORY_META,
  SUPPORT_PRIORITY_META,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";

export default function MerchantTicketDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const toast = useToast();
  const { loading } = useAuth();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useTickets();
  const ticket = all.find((t) => t.id === Number(params.id));
  const isMine = ticket != null && ticket.merchantId === me.id;

  useEffect(() => {
    if (!loading && isMine && ticket?.unreadForMerchant)
      markTicketRead(ticket.id, "merchant");
  }, [loading, isMine, ticket?.id, ticket?.unreadForMerchant]);

  // Wait for the session before judging ownership — otherwise the merchant
  // resolves to the fallback on first render and we'd 404 our own ticket.
  if (loading) return <PanelLoading />;
  requireOwned(ticket, isMine);

  const closed = ticket.status === "closed";

  const toggleClose = () => {
    if (closed) {
      setTicketStatus(ticket.id, "open");
      toast.success("Ticket reopened");
    } else {
      setTicketStatus(ticket.id, "closed");
      toast.success("Ticket closed");
    }
  };

  return (
    <div className="space-y-4">
      <Link
        href="/merchant/support"
        className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
      >
        <ArrowLeft className="h-4 w-4" /> Back to tickets
      </Link>

      <Card>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
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
            {ticket.trackingId && (
              <p className="mt-2 text-xs text-brown-500">
                Related parcel:{" "}
                <Link
                  href={`/track/${ticket.trackingId}`}
                  target="_blank"
                  className="font-mono text-primary hover:underline"
                >
                  {ticket.trackingId}
                </Link>
              </p>
            )}
            <p className="mt-1 text-xs text-brown-400">
              Opened {formatDateTime(ticket.createdAt)}
            </p>
          </div>
          <Button variant={closed ? "primary" : "outline"} size="sm" onClick={toggleClose}>
            {closed ? (
              <>
                <RotateCcw className="h-4 w-4" /> Reopen
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4" /> Close ticket
              </>
            )}
          </Button>
        </div>
      </Card>

      <Card title="Conversation">
        <TicketThread ticket={ticket} side="merchant" senderName={me.name} />
      </Card>
    </div>
  );
}
