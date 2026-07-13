"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/remittances.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listRemittances,
  createRemittance as apiCreateRemittance,
  confirmRemittance as apiConfirmRemittance,
} from "@/lib/api/cod";
import type { HubRemittance } from "@/types";

// Hub → HQ cash remittances. Reads from the API when configured; falls back to
// the in-memory mock seed otherwise.

const USE_API = apiEnabled();

let remittances: HubRemittance[] = USE_API ? [] : (seed as HubRemittance[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<HubRemittance>(
  "remittances",
  () => remittances,
  (next) => {
    remittances = next;
  },
  notify,
);

let loaded = false;
function reload(): Promise<void> {
  return listRemittances(200)
    .then((res) => {
      remittances = res.results ?? (res as unknown as HubRemittance[]);
      notify();
    })
    .catch(() => {});
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
const getSnapshot = () => remittances;

export function useRemittances(): HubRemittance[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export type NewRemittance = Pick<
  HubRemittance,
  "branchId" | "amount" | "parcelCount" | "reference" | "note"
>;

export async function addRemittance(data: NewRemittance): Promise<void> {
  if (USE_API) {
    await apiCreateRemittance({
      amount: data.amount,
      reference: data.reference,
      note: data.note,
      branchId: data.branchId,
    });
    await reload();
    return;
  }
  hydrate();
  const id = Math.max(0, ...remittances.map((r) => r.id)) + 1;
  remittances = [
    {
      ...data,
      id,
      status: "pending",
      remittedAt: new Date().toISOString().slice(0, 10),
    },
    ...remittances,
  ];
  emit();
}

export async function confirmRemittance(id: number): Promise<void> {
  if (USE_API) {
    await apiConfirmRemittance(id);
    await reload();
    return;
  }
  remittances = remittances.map((r) =>
    r.id === id
      ? { ...r, status: "received", receivedAt: new Date().toISOString().slice(0, 10) }
      : r,
  );
  emit();
}

// Total a hub has sent to HQ (in-transit + received), used for outstanding calc.
export function remittedForBranch(list: HubRemittance[], branchId: number): number {
  return list
    .filter((r) => r.branchId === branchId)
    .reduce((s, r) => s + r.amount, 0);
}
