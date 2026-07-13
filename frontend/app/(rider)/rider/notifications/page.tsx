"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, PackagePlus, Repeat, CheckCheck, ChevronRight } from "lucide-react";
import { useRiderScope } from "@/hooks/useRiderScope";
import {
  useRiderNotifications,
  notificationsForRider,
  markRiderNotificationRead,
  markAllRiderNotificationsRead,
} from "@/lib/notification-store";
import { cn, formatDateTime } from "@/lib/utils";
import type { RiderNotification } from "@/types";

export default function RiderNotificationsPage() {
  const router = useRouter();
  const { deliveryManId } = useRiderScope();
  const all = useRiderNotifications();

  const list = useMemo(
    () => (deliveryManId == null ? [] : notificationsForRider(all, deliveryManId)),
    [all, deliveryManId],
  );
  const hasUnread = list.some((n) => !n.read);

  const open = (n: RiderNotification) => {
    markRiderNotificationRead(n.id);
    if (n.parcelId != null) router.push(`/rider/parcels/${n.parcelId}`);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold tracking-tight text-brown-800">Notifications</h1>
        {hasUnread && deliveryManId != null && (
          <button
            onClick={() => markAllRiderNotificationsRead(deliveryManId)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            <CheckCheck className="h-3.5 w-3.5" /> Mark all read
          </button>
        )}
      </div>

      {list.length === 0 ? (
        <div className="rounded-xl border border-dashed border-brown-200 bg-white p-8 text-center">
          <Bell className="mx-auto mb-2 h-8 w-8 text-brown-200" />
          <p className="text-sm text-brown-500">No notifications yet.</p>
        </div>
      ) : (
        <div className="space-y-2">
          {list.map((n) => {
            const Icon = n.type === "reassignment" ? Repeat : PackagePlus;
            return (
              <button
                key={n.id}
                onClick={() => open(n)}
                className={cn(
                  "flex w-full items-start gap-3 rounded-xl border p-3 text-left shadow-card transition-colors",
                  n.read
                    ? "border-brown-100 bg-white"
                    : "border-primary-100 bg-primary-50/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-9 w-9 shrink-0 items-center justify-center rounded-lg",
                    n.read ? "bg-brown-100 text-brown-500" : "bg-primary-100 text-primary",
                  )}
                >
                  <Icon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-brown-800">{n.title}</p>
                    {!n.read && <span className="h-2 w-2 shrink-0 rounded-full bg-primary" />}
                  </div>
                  <p className="truncate text-xs text-brown-500">{n.body}</p>
                  <p className="mt-0.5 text-[11px] text-brown-400">{formatDateTime(n.createdAt)}</p>
                </div>
                {n.parcelId != null && (
                  <ChevronRight className="mt-1 h-4 w-4 shrink-0 text-brown-400" />
                )}
              </button>
            );
          })}
        </div>
      )}

      <Link href="/rider/dashboard" className="block text-center text-xs text-brown-500 hover:text-primary">
        Back to dashboard
      </Link>
    </div>
  );
}
