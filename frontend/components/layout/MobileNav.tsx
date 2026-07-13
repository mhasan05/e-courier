"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { navForRole } from "@/lib/constants";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useSiteSettings } from "@/lib/site-settings-store";
import BrandMark from "@/components/ui/BrandMark";
import Skeleton from "@/components/ui/Skeleton";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

// Hamburger + slide-in drawer that gives dashboard pages navigation on small
// screens (the desktop Sidebar is hidden below md).
export default function MobileNav({ role }: { role: Role }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const items = navForRole(role);
  const badges = useNavBadges(role);
  const { companyName: appName, ready } = useSiteSettings();

  const activeHref = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md p-2 text-brown-600 hover:bg-brown-100 md:hidden"
        aria-label="Open menu"
      >
        <Menu className="h-5 w-5" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <div
            className="absolute inset-0 bg-brown-900/40"
            onClick={() => setOpen(false)}
            aria-hidden
          />
          <div className="absolute left-0 top-0 flex h-full w-64 flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-brown-100 px-5">
              <div className="flex items-center gap-2">
                <BrandMark className="h-9 w-9 rounded-lg" iconClass="h-5 w-5" />
                {ready ? (
                  <span className="text-sm font-semibold text-brown-800">{appName}</span>
                ) : (
                  <Skeleton className="h-5 w-24" />
                )}
              </div>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1 text-brown-500 hover:bg-brown-100"
                aria-label="Close menu"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav className="scrollbar-thin flex-1 space-y-1 overflow-y-auto px-3 py-4">
              {items.map((item) => {
                const Icon = item.icon;
                const active = item.href === activeHref;
                const badge = badges[item.href];
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-white"
                        : "text-brown-600 hover:bg-primary-50 hover:text-primary-700",
                    )}
                  >
                    <Icon className="h-[18px] w-[18px]" />
                    {item.label}
                    {badge ? (
                      <span
                        className={cn(
                          "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                          active ? "bg-white text-primary" : "bg-red-500 text-white",
                        )}
                      >
                        {badge > 9 ? "9+" : badge}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </nav>
          </div>
        </div>
      )}
    </>
  );
}
