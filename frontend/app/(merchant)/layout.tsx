"use client";

import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";
import PanelLoading from "@/components/layout/PanelLoading";
import { useMerchants } from "@/lib/merchant-store";
import { useAuth } from "@/hooks/useAuth";
import { apiEnabled } from "@/lib/api";

// Ensures the current merchant is loaded from the API before any /merchant/*
// page renders, so `useCurrentMerchant()` always has data (pages read it
// synchronously). No-op in mock mode where the seed is present immediately.
function MerchantGate({ children }: { children: ReactNode }) {
  const { email } = useAuth();
  const merchants = useMerchants();
  const ready = !apiEnabled() || merchants.some((m) => m.email === email);
  if (!ready) return <PanelLoading />;
  return <>{children}</>;
}

// Wraps every /merchant/* route with the guard, sidebar, and topbar.
export default function MerchantLayout({ children }: { children: ReactNode }) {
  return (
    <DashboardShell role="merchant">
      <MerchantGate>{children}</MerchantGate>
    </DashboardShell>
  );
}
