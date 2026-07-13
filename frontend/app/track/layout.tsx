"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { useSiteSettings } from "@/lib/site-settings-store";
import BrandMark from "@/components/ui/BrandMark";
import Skeleton from "@/components/ui/Skeleton";

// Public, no-auth layout for customer parcel tracking.
export default function TrackLayout({ children }: { children: ReactNode }) {
  const { companyName: appName, ready } = useSiteSettings();
  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <header className="border-b border-brown-100 bg-white">
        <div className="mx-auto flex h-16 max-w-3xl items-center gap-2 px-4">
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-9 w-9 rounded-xl shadow-sm" iconClass="h-5 w-5" />
            {ready ? (
              <span className="font-semibold tracking-tight text-brown-900">{appName}</span>
            ) : (
              <Skeleton className="h-5 w-28" />
            )}
          </Link>
          <span className="ml-auto text-sm text-brown-500">Parcel Tracking</span>
        </div>
      </header>
      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-8">{children}</main>
      <footer className="border-t border-brown-100 py-4 text-center text-xs text-brown-400">
        {ready ? `© ${new Date().getFullYear()} ${appName}` : <Skeleton className="mx-auto h-3 w-32" />}
      </footer>
    </div>
  );
}
