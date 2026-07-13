"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { navForRole, panelLabelForRole } from "@/lib/constants";
import { useNavBadges } from "@/hooks/useNavBadges";
import { useSiteSettings } from "@/lib/site-settings-store";
import BrandMark from "@/components/ui/BrandMark";
import { cn } from "@/lib/utils";
import type { Role } from "@/types";

export interface SidebarProps {
  role: Role;
}

// Role-aware sidebar with active-state highlighting.
export default function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const items = navForRole(role);
  const badges = useNavBadges(role);
  const appName = useSiteSettings().companyName;

  // The active item is the longest href that matches the current path (exact
  // or as a parent segment), so nested routes highlight just one nav item.
  const activeHref = items
    .map((i) => i.href)
    .filter((href) => pathname === href || pathname.startsWith(href + "/"))
    .sort((a, b) => b.length - a.length)[0];

  return (
    <aside className="hidden w-64 shrink-0 flex-col border-r border-brown-100 bg-white md:flex">
      <div className="flex h-16 items-center gap-2.5 px-5">
        <BrandMark className="h-9 w-9 rounded-xl shadow-sm shadow-primary-900/20" />
        <div className="leading-tight">
          <p className="text-[15px] font-semibold tracking-tight text-brown-900">{appName}</p>
          <p className="text-[11px] font-medium uppercase tracking-wide text-brown-400">
            {panelLabelForRole(role)} Panel
          </p>
        </div>
      </div>

      <nav className="scrollbar-thin flex-1 space-y-0.5 overflow-y-auto px-3 pb-4 pt-2">
        <p className="px-3 pb-1.5 pt-2 text-[10px] font-semibold uppercase tracking-[0.08em] text-brown-400">
          Menu
        </p>
        {items.map((item) => {
          // Highlight only the single most-specific match. Both "/parcels" and
          // "/parcels/new" match on the booking route, so we pick the longest
          // matching href as active — otherwise both items light up at once.
          const active = item.href === activeHref;
          const Icon = item.icon;
          const badge = badges[item.href];
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "group relative flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition-colors",
                active
                  ? "bg-primary-50 font-semibold text-primary-700"
                  : "font-medium text-brown-600 hover:bg-brown-50 hover:text-brown-900",
              )}
            >
              {active && (
                <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-primary" />
              )}
              <Icon
                className={cn(
                  "h-[18px] w-[18px] shrink-0 transition-colors",
                  active ? "text-primary" : "text-brown-400 group-hover:text-brown-600",
                )}
              />
              {item.label}
              {badge ? (
                <span
                  className={cn(
                    "ml-auto flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-bold",
                    active ? "bg-primary text-white" : "bg-danger-500 text-white",
                  )}
                >
                  {badge > 9 ? "9+" : badge}
                </span>
              ) : null}
            </Link>
          );
        })}
      </nav>

      <div className="mx-3 mb-3 rounded-xl border border-brown-100 bg-brown-50/60 px-3 py-2.5">
        <p className="text-[11px] font-medium text-brown-600">
          © {new Date().getFullYear()} {appName}
        </p>
        <p className="mt-0.5 flex items-center gap-1.5 text-[10px] text-brown-400">
          <span className="h-1.5 w-1.5 rounded-full bg-success-500" />
          All systems operational
        </p>
      </div>
    </aside>
  );
}
