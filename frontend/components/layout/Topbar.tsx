"use client";

import { Bell } from "lucide-react";
import Image from "next/image";
import { usePathname } from "next/navigation";
import Breadcrumb from "./Breadcrumb";
import MobileNav from "./MobileNav";
import Dropdown from "@/components/ui/Dropdown";
import { useAuth } from "@/hooks/useAuth";
import { useAvatar } from "@/lib/avatar-store";
import type { Role } from "@/types";

function titleFromPath(pathname: string): string {
  const segments = pathname.split("/").filter(Boolean);
  const last = segments[segments.length - 1] || "Dashboard";
  // Dynamic id segments shouldn't surface as a title.
  const label = /^\d+$/.test(last) ? segments[segments.length - 2] || last : last;
  return label.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

// Page title + breadcrumb on the left; notification bell + user menu on the right.
export default function Topbar({ role }: { role: Role }) {
  const pathname = usePathname();
  const title = titleFromPath(pathname);
  const { name, email, logout } = useAuth();
  const avatar = useAvatar(email);
  const initial = (name || "U").charAt(0).toUpperCase();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-brown-100 bg-white/80 px-5 backdrop-blur-md">
      <div className="flex items-center gap-2">
        <MobileNav role={role} />
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-brown-900">{title}</h1>
          <Breadcrumb />
        </div>
      </div>

      <div className="flex items-center gap-2">
        <button
          className="relative rounded-lg border border-transparent p-2 text-brown-500 transition-colors hover:border-brown-100 hover:bg-brown-50 hover:text-brown-700"
          aria-label="Notifications"
        >
          <Bell className="h-[18px] w-[18px]" />
          <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-danger-500 ring-2 ring-white" />
        </button>

        <div className="mx-1 hidden h-6 w-px bg-brown-100 sm:block" />

        <Dropdown
          align="right"
          trigger={
            <span className="flex items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 transition-colors hover:border-brown-100 hover:bg-brown-50">
              <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-gradient-to-br from-primary to-primary-700 text-sm font-semibold text-white ring-2 ring-white">
                {avatar ? (
                  <Image
                    src={avatar}
                    alt={name || "User"}
                    width={32}
                    height={32}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                ) : (
                  initial
                )}
              </span>
              <span className="hidden text-left leading-tight sm:block">
                <span className="block text-sm font-semibold text-brown-900">
                  {name || "User"}
                </span>
                <span className="block text-xs text-brown-400">{email}</span>
              </span>
            </span>
          }
          items={[{ label: "Logout", onClick: logout, danger: true }]}
        />
      </div>
    </header>
  );
}
