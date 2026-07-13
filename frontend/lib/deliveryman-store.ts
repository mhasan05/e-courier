"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/deliverymen.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listRiders,
  getMyRider,
  createRider,
  updateRider,
  setRiderStatus,
  uploadRiderDocuments,
  resetRiderPassword as apiResetRiderPassword,
} from "@/lib/api/riders";
import type { DeliveryMan } from "@/types";

// Delivery-man store. Reads from the Django API when configured; falls back to
// the in-memory mock seed otherwise. Hook/getter names are stable.

// Default password for a newly-created rider — must match the backend
// (DeliveryManCreateSerializer applies DEFAULT_RIDER_PASSWORD = "12345678").
export const DEFAULT_DELIVERYMAN_PASSWORD = "12345678";

const USE_API = apiEnabled();

interface StoredDeliveryMan extends DeliveryMan {
  password?: string;
}

let people: StoredDeliveryMan[] = USE_API
  ? []
  : (seed as DeliveryMan[]).map((d) => ({
      ...d,
      password: DEFAULT_DELIVERYMAN_PASSWORD,
    }));

const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<StoredDeliveryMan>(
  "deliverymen",
  () => people,
  (next) => {
    people = next;
  },
  notify,
);

let loaded = false;
// True once the initial API fetch has settled (see parcel-store for rationale).
let ready = !USE_API;
function reload(): Promise<void> {
  return listRiders({ pageSize: 500 })
    .then((res) => {
      people = res.results ?? (res as unknown as DeliveryMan[]);
      notify();
    })
    .catch(() =>
      // A delivery man can't list all riders — load just their own profile
      // via /riders/me/ so the rider panel resolves their account.
      getMyRider()
        .then((me) => {
          people = me ? [me] : [];
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

function emit() {
  if (!USE_API) persist();
  notify();
}
function subscribe(listener: () => void) {
  listeners.add(listener);
  if (USE_API) ensureLoaded();
  else hydrate();
  return () => listeners.delete(listener);
}
function getSnapshot() {
  return people;
}

/** Re-fetch riders from the API (e.g. after a hub area rename/delete cascade). */
export function refreshDeliveryMen(): void {
  if (USE_API) void reload();
}

export type NewDeliveryMan = Omit<DeliveryMan, "id" | "status" | "createdAt">;

// Convert a data-URL (from a file input preview) to a Blob for multipart upload.
async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

async function uploadDocs(id: number, data: NewDeliveryMan) {
  const fd = new FormData();
  let any = false;
  const add = async (key: string, url?: string) => {
    if (url && url.startsWith("data:")) {
      fd.append(key, await dataUrlToBlob(url), `${key}.jpg`);
      any = true;
    }
  };
  await add("photo", data.photo);
  await add("nid_image", data.nidImage);
  await add("passport_image", data.passportImage);
  if (any) await uploadRiderDocuments(id, fd);
}

export async function addDeliveryMan(
  data: NewDeliveryMan,
): Promise<DeliveryMan | undefined> {
  if (USE_API) {
    const created = await createRider({
      name: data.name,
      phone: data.phone,
      email: data.email,
      nid: data.nid,
      passport: data.passport,
      branchId: data.branchId ?? null,
      ...(data.areas && data.areas.length ? { areas: data.areas } : {}),
    });
    try {
      await uploadDocs(created.id, data);
    } catch {
      /* documents are optional — creation still succeeded */
    }
    await reload();
    return created;
  }
  hydrate();
  const id = Math.max(0, ...people.map((p) => p.id)) + 1;
  const created: StoredDeliveryMan = {
    ...data,
    id,
    status: "active",
    createdAt: new Date().toISOString().slice(0, 10),
    password: DEFAULT_DELIVERYMAN_PASSWORD,
  };
  people = [created, ...people];
  emit();
  return created;
}

export async function setDeliveryManStatus(
  id: number,
  status: DeliveryMan["status"],
): Promise<void> {
  if (USE_API) {
    await setRiderStatus(id, status);
    await reload();
    return;
  }
  people = people.map((p) => (p.id === id ? { ...p, status } : p));
  emit();
}

export async function updateDeliveryMan(
  id: number,
  patch: Partial<DeliveryMan>,
): Promise<void> {
  if (USE_API) {
    await updateRider(id, {
      name: patch.name,
      phone: patch.phone,
      nid: patch.nid,
      passport: patch.passport,
      ...(patch.branchId !== undefined ? { branchId: patch.branchId } : {}),
      ...(patch.areas !== undefined ? { areas: patch.areas } : {}),
    });
    await reload();
    return;
  }
  people = people.map((p) => (p.id === id ? { ...p, ...patch } : p));
  emit();
}

export function getDeliveryManById(id?: number): DeliveryMan | undefined {
  if (id == null) return undefined;
  if (USE_API) ensureLoaded();
  else hydrate();
  return people.find((p) => p.id === id);
}

// ── Mock-mode rider auth helpers ────────────────────────────────────────────
// In API mode, rider login and password changes go through the JWT auth API;
// these operate on the mock cache and are only used when the API is disabled.

export function authenticateRider(
  identifier: string,
  password: string,
): DeliveryMan | null {
  if (USE_API) return null;
  hydrate();
  const id = identifier.trim().toLowerCase();
  const rider = people.find(
    (p) => p.email.toLowerCase() === id || p.phone === identifier.trim(),
  );
  if (!rider || rider.status !== "active" || rider.password !== password) {
    return null;
  }
  return rider;
}

export function setRiderPassword(id: number, password: string): void {
  if (USE_API) return;
  hydrate();
  people = people.map((p) => (p.id === id ? { ...p, password } : p));
  emit();
}

/** Admin / hub-manager reset of a rider's login password. */
export async function resetRiderPassword(id: number, password: string): Promise<void> {
  if (USE_API) {
    await apiResetRiderPassword(id, password);
    return;
  }
  setRiderPassword(id, password);
}

export function verifyRiderPassword(id: number, password: string): boolean {
  if (USE_API) return true;
  hydrate();
  const rider = people.find((p) => p.id === id);
  return rider != null && rider.password === password;
}

export function riderUsesDefaultPassword(id: number): boolean {
  if (USE_API) return false;
  return verifyRiderPassword(id, DEFAULT_DELIVERYMAN_PASSWORD);
}

export function useDeliveryMen(): DeliveryMan[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True once the initial API fetch has settled. */
export function useDeliveryMenReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}
