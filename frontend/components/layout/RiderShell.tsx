"use client";

import { useEffect, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut, Bell } from "lucide-react";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import BrandMark from "@/components/ui/BrandMark";
import { RIDER_NAV } from "@/lib/constants";
import { useAuth } from "@/hooks/useAuth";
import {
  useRiderNotifications,
  unreadCountForRider,
  refreshNotifications,
} from "@/lib/notification-store";
import { apiEnabled } from "@/lib/api";
import { notificationsSocket } from "@/lib/api/ws";
import { cn } from "@/lib/utils";

// Mobile-first app frame for the delivery man: top header + scrollable content
// + fixed bottom tab bar. Centered to a phone width on larger screens.
export default function RiderShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const { name, logout, deliveryManId } = useAuth();
  const notifications = useRiderNotifications();
  const unread =
    deliveryManId == null ? 0 : unreadCountForRider(notifications, deliveryManId);

  // Live push: subscribe to the notifications WebSocket; refetch on any event.
  useEffect(() => {
    if (!apiEnabled()) return;
    const sock = notificationsSocket();
    if (!sock) return;
    sock.onmessage = () => refreshNotifications();
    return () => sock.close();
  }, []);

  const activeHref = RIDER_NAV.map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <ProtectedRoute role="delivery_man">
      <div className="min-h-screen bg-brown-100/50">
        <div className="mx-auto flex h-screen max-w-md flex-col bg-canvas shadow-2xl md:my-0 md:border-x md:border-brown-100">
          {/* Header */}
          <header className="flex h-16 shrink-0 items-center justify-between border-b border-brown-100 bg-white/80 px-4 backdrop-blur-md">
            <div className="flex items-center gap-2.5">
              <BrandMark className="h-9 w-9 rounded-xl shadow-sm shadow-primary-900/20" />
              <div className="leading-tight">
                <p className="text-sm font-semibold tracking-tight text-brown-900">{name || "Rider"}</p>
                <p className="text-[10px] font-medium uppercase tracking-wide text-brown-400">
                  Delivery Panel
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              <Link
                href="/rider/notifications"
                className="relative rounded-lg p-2 text-brown-500 transition-colors hover:bg-brown-50 hover:text-brown-700"
                aria-label="Notifications"
              >
                <Bell className="h-[18px] w-[18px]" />
                {unread > 0 && (
                  <span className="absolute right-0.5 top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-danger-500 px-1 text-[10px] font-bold text-white ring-2 ring-white">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </Link>
              <button
                onClick={logout}
                className="rounded-lg p-2 text-brown-500 transition-colors hover:bg-danger-50 hover:text-danger-600"
                aria-label="Logout"
              >
                <LogOut className="h-[18px] w-[18px]" />
              </button>
            </div>
          </header>

          {/* Content */}
          <main className="scrollbar-thin flex-1 overflow-y-auto p-4">{children}</main>

          {/* Bottom tab bar */}
          <nav className="grid shrink-0 grid-cols-4 border-t border-brown-100 bg-white/90 pb-[env(safe-area-inset-bottom)] backdrop-blur">
            {RIDER_NAV.map((item) => {
              const Icon = item.icon;
              const active = item.href === activeHref;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "relative flex flex-col items-center gap-1 py-2.5 text-[11px] font-medium transition-colors",
                    active ? "text-primary-700" : "text-brown-400 hover:text-brown-600",
                  )}
                >
                  {active && (
                    <span className="absolute left-1/2 top-0 h-0.5 w-8 -translate-x-1/2 rounded-b-full bg-primary" />
                  )}
                  <span
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-xl transition-colors",
                      active && "bg-primary-50",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                  </span>
                  {item.label}
                </Link>
              );
            })}
          </nav>
        </div>
      </div>
    </ProtectedRoute>
  );
}
