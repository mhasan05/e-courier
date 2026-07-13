"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/merchants.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listMerchants,
  getMyMerchant,
  updateMerchant as apiUpdateMerchant,
  setMerchantStatus as apiSetMerchantStatus,
  assignMerchantBranch as apiAssignMerchantBranch,
} from "@/lib/api/merchants";
import type { Merchant, MerchantStatus } from "@/types";

// Merchant store. Reads from the Django API when configured; falls back to the
// in-memory mock seed otherwise. For a merchant user the admin list is not
// accessible, so we fall back to `/merchants/me`.

const USE_API = apiEnabled();

let merchants: Merchant[] = USE_API ? [] : (seed as Merchant[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<Merchant>(
  "merchants",
  () => merchants,
  (next) => {
    merchants = next;
  },
  notify,
);

let loaded = false;
// True once the initial API fetch has settled (see parcel-store for rationale).
let ready = !USE_API;
function reload(): Promise<void> {
  return listMerchants({ pageSize: 500 })
    .then((res) => {
      merchants = res.results ?? (res as unknown as Merchant[]);
      notify();
    })
    .catch(() =>
      // Merchant users can't list all merchants — load just themselves.
      getMyMerchant()
        .then((m) => {
          merchants = m ? [m] : [];
          notify();
        })
        .catch(() => {}),
    )
    .finally(() => {
      ready = true;
      notify();
    });
}
function ensureLoaded() {
  if (!USE_API || loaded || typeof window === "undefined") return;
  loaded = true;
  void reload();
}
ensureLoaded();

const emit = () => {
  if (!USE_API) persist();
  notify();
};
const subscribe = (l: () => void) => {
  listeners.add(l);
  if (USE_API) ensureLoaded();
  else hydrate();
  return () => listeners.delete(l);
};
const getSnapshot = () => merchants;

export function getMerchants(): Merchant[] {
  if (USE_API) ensureLoaded();
  else hydrate();
  return merchants;
}

export function getMerchantById(id?: number | null): Merchant | undefined {
  if (id == null) return undefined;
  if (USE_API) ensureLoaded();
  else hydrate();
  return merchants.find((m) => m.id === id);
}

export function getMerchantByEmail(email?: string | null): Merchant | undefined {
  if (!email) return undefined;
  if (USE_API) ensureLoaded();
  else hydrate();
  return merchants.find((m) => m.email === email);
}

export async function setMerchantStatus(
  id: number,
  status: MerchantStatus,
): Promise<void> {
  if (USE_API) {
    await apiSetMerchantStatus(id, status);
    await reload();
    return;
  }
  merchants = merchants.map((m) => (m.id === id ? { ...m, status } : m));
  emit();
}

export async function updateMerchant(
  id: number,
  patch: Partial<Merchant>,
): Promise<void> {
  if (USE_API) {
    await apiUpdateMerchant(id, {
      name: patch.name,
      shopName: patch.shopName,
      phone: patch.phone,
      address: patch.address,
      district: patch.district,
      businessType: patch.businessType,
    });
    await reload();
    return;
  }
  merchants = merchants.map((m) => (m.id === id ? { ...m, ...patch } : m));
  emit();
}

export async function assignMerchantBranch(
  id: number,
  branchId: number,
): Promise<void> {
  if (USE_API) {
    await apiAssignMerchantBranch(id, branchId);
    await reload();
    return;
  }
  merchants = merchants.map((m) =>
    m.id === id ? { ...m, homeBranchId: branchId } : m,
  );
  emit();
}

export function useMerchants(): Merchant[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True once the initial API fetch has settled. */
export function useMerchantsReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}
