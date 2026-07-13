"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/rider-handovers.json";
import { collectedCodOf } from "@/lib/parcel-store";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listHandovers,
  createHandover as apiCreateHandover,
  confirmHandover as apiConfirmHandover,
} from "@/lib/api/cod";
import type { Parcel, RiderHandover } from "@/types";

// Rider → hub cash handovers. Reads from the API when configured; falls back to
// the in-memory mock seed otherwise. The cash-in-hand helpers below compute
// from parcels + handovers (both API-backed), so they need no changes.

const USE_API = apiEnabled();

let handovers: RiderHandover[] = USE_API ? [] : (seed as RiderHandover[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<RiderHandover>(
  "rider-handovers",
  () => handovers,
  (next) => {
    handovers = next;
  },
  notify,
);

let loaded = false;
function reload(): Promise<void> {
  return listHandovers(200)
    .then((res) => {
      handovers = res.results ?? (res as unknown as RiderHandover[]);
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
const getSnapshot = () => handovers;

export function useRiderHandovers(): RiderHandover[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// All parcel ids a rider has already handed over (pending OR received).
export function handedOverParcelIds(
  list: RiderHandover[],
  riderId: number,
): Set<number> {
  const ids = new Set<number>();
  list
    .filter((h) => h.riderId === riderId)
    .forEach((h) => h.parcelIds.forEach((id) => ids.add(id)));
  return ids;
}

// COD parcels a rider has collected but not yet handed over.
export function cashInHandParcels(
  parcels: Parcel[],
  list: RiderHandover[],
  riderId: number,
): Parcel[] {
  const settled = handedOverParcelIds(list, riderId);
  return parcels.filter(
    (p) =>
      p.deliveryManId === riderId &&
      (p.status === "delivered" || p.status === "partially_delivered") &&
      collectedCodOf(p) > 0 &&
      !settled.has(p.id),
  );
}

// In API mode the server computes the rider's cash-in-hand and creates the
// handover; the passed parcels are used only for the mock path.
export async function createRiderHandover(data: {
  riderId: number;
  riderName: string;
  branchId: number;
  parcels: Parcel[];
}): Promise<RiderHandover | null> {
  const { riderId, riderName, branchId, parcels } = data;
  if (parcels.length === 0) return null;
  if (USE_API) {
    const created = await apiCreateHandover();
    await reload();
    return created;
  }
  hydrate();
  const id = Math.max(0, ...handovers.map((h) => h.id)) + 1;
  const amount = parcels.reduce((s, p) => s + collectedCodOf(p), 0);
  const handover: RiderHandover = {
    id,
    riderId,
    riderName,
    branchId,
    amount,
    parcelCount: parcels.length,
    parcelIds: parcels.map((p) => p.id),
    reference: `RH-${String(id).padStart(4, "0")}`,
    status: "pending",
    remittedAt: new Date().toISOString().slice(0, 10),
  };
  handovers = [handover, ...handovers];
  emit();
  return handover;
}

export async function confirmRiderHandover(
  id: number,
  confirmedBy: string,
): Promise<void> {
  if (USE_API) {
    await apiConfirmHandover(id);
    await reload();
    return;
  }
  handovers = handovers.map((h) =>
    h.id === id
      ? {
          ...h,
          status: "received",
          receivedAt: new Date().toISOString().slice(0, 10),
          confirmedBy,
        }
      : h,
  );
  emit();
}
