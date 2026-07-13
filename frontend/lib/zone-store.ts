"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/zones.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listZones,
  createZone as apiCreateZone,
  updateZone as apiUpdateZone,
  deleteZone as apiDeleteZone,
} from "@/lib/api/zones";
import type { Zone } from "@/types";

// Delivery-zone (pricing) store. Reads from the API when configured; falls back
// to the mock seed otherwise. Sync getters serve the charge-preview helpers.

const USE_API = apiEnabled();

let zones: Zone[] = USE_API ? [] : (seed as Zone[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<Zone>(
  "zones",
  () => zones,
  (next) => {
    zones = next;
  },
  notify,
);

let loaded = false;
function reload(): Promise<void> {
  return listZones(200)
    .then((res) => {
      zones = res.results ?? (res as unknown as Zone[]);
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
const getSnapshot = () => zones;

/** Non-reactive getter for the charge-preview helpers. */
export function getZones(): Zone[] {
  if (USE_API) ensureLoaded();
  else hydrate();
  return zones;
}

export function useZones(): Zone[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export type NewZone = Omit<Zone, "id">;

export async function addZone(data: NewZone): Promise<void> {
  if (USE_API) {
    await apiCreateZone(data);
    await reload();
    return;
  }
  const id = Math.max(0, ...zones.map((z) => z.id)) + 1;
  zones = [...zones, { ...data, id }];
  emit();
}

export async function updateZone(id: number, patch: Partial<Zone>): Promise<void> {
  if (USE_API) {
    await apiUpdateZone(id, patch);
    await reload();
    return;
  }
  zones = zones.map((z) => (z.id === id ? { ...z, ...patch } : z));
  emit();
}

export async function deleteZone(id: number): Promise<void> {
  if (USE_API) {
    await apiDeleteZone(id);
    await reload();
    return;
  }
  zones = zones.filter((z) => z.id !== id);
  emit();
}
