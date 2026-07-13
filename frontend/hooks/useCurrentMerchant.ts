"use client";

import { useMerchants } from "@/lib/merchant-store";
import { useAuth } from "@/hooks/useAuth";
import type { Merchant } from "@/types";

// Resolves the logged-in merchant from the reactive store by email. Returns
// undefined while the store is still loading from the API (empty on first
// render) — callers under MerchantGate are guaranteed a value, but shared
// chrome (sidebar/topbar) rendered outside the gate must guard. Reads from the
// store so changes (e.g. an admin reassigning the merchant's hub) reflect live.
export function useCurrentMerchant(): Merchant | undefined {
  const { email } = useAuth();
  const merchants = useMerchants();
  return merchants.find((m) => m.email === email) ?? merchants[0];
}
