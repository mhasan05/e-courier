"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import { Truck, Zap, ShieldCheck, MapPin } from "lucide-react";
import { useSiteSettings } from "@/lib/site-settings-store";

// Split-screen auth shell: branded panel on the left, form on the right.
export default function AuthLayout({ children }: { children: ReactNode }) {
  const { companyName: appName, logoUrl } = useSiteSettings();
  return (
    <div className="flex min-h-screen bg-canvas">
      {/* Brand panel — desktop only */}
      <aside className="relative hidden w-1/2 flex-col justify-between overflow-hidden bg-gradient-to-br from-primary-700 via-primary to-primary-800 p-12 text-white lg:flex">
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.15]" />
        <div className="pointer-events-none absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-32 -left-16 h-96 w-96 rounded-full bg-primary-900/40 blur-3xl" />

        <div className="relative flex items-center gap-2.5">
          <span className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-xl bg-white/15 ring-1 ring-white/25 backdrop-blur">
            {logoUrl ? (
              <Image src={logoUrl} alt={appName} width={40} height={40} unoptimized className="h-full w-full object-contain" />
            ) : (
              <Truck className="h-5 w-5" />
            )}
          </span>
          <span className="text-lg font-semibold tracking-tight">{appName}</span>
        </div>

        <div className="relative max-w-md">
          <h2 className="text-4xl font-semibold leading-tight tracking-tight">
            Deliver more,
            <br />
            manage less.
          </h2>
          <p className="mt-4 text-[15px] leading-relaxed text-white/70">
            One command center for parcels, riders, COD, and merchants — from
            pickup to doorstep.
          </p>

          <ul className="mt-10 space-y-4">
            {[
              { icon: Zap, title: "Real-time tracking", desc: "Live status from pickup to delivery." },
              { icon: MapPin, title: "Zone-smart routing", desc: "Assign riders by coverage area." },
              { icon: ShieldCheck, title: "COD reconciliation", desc: "Transparent cash flow, every day." },
            ].map((f) => (
              <li key={f.title} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white/10 ring-1 ring-white/15">
                  <f.icon className="h-[18px] w-[18px]" />
                </span>
                <div>
                  <p className="text-sm font-semibold">{f.title}</p>
                  <p className="text-sm text-white/60">{f.desc}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>

        <p className="relative text-xs text-white/50">
          © {new Date().getFullYear()} {appName}. All rights reserved.
        </p>
      </aside>

      {/* Form area */}
      <div className="flex w-full items-center justify-center px-4 py-10 lg:w-1/2">
        {children}
      </div>
    </div>
  );
}
