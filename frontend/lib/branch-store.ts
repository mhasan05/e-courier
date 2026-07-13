"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/branches.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listBranches,
  createBranch as apiCreateBranch,
  updateBranch as apiUpdateBranch,
  toggleBranch as apiToggleBranch,
} from "@/lib/api/branches";
import type { Branch } from "@/types";

// Branch (hub) store. Reads from the Django API when NEXT_PUBLIC_API_URL is set;
// otherwise falls back to the in-memory mock seed. Hook/getter names are stable
// so consuming pages and routing helpers don't change.

const USE_API = apiEnabled();

let branches: Branch[] = USE_API ? [] : (seed as Branch[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

// Mock-mode persistence only (API mode: the server is the source of truth).
const { persist, hydrate } = persistList<Branch>(
  "branches",
  () => branches,
  (next) => {
    branches = next;
  },
  notify,
);

// ── API loading ─────────────────────────────────────────────────────────────
let loaded = false;
function reload(): Promise<void> {
  return listBranches({ pageSize: 200 })
    .then((res) => {
      branches = res.results ?? (res as unknown as Branch[]);
      notify();
    })
    .catch(() => {
      /* keep the current cache on transient errors */
    });
}
function ensureLoaded() {
  if (!USE_API || loaded || typeof window === "undefined") return;
  loaded = true;
  void reload();
}
// Warm the cache as soon as this module is imported on the client, so
// synchronous routing/booking getters have data without waiting for a mount.
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
const getSnapshot = () => branches;

/** Non-reactive getter for event handlers (booking, import, routing). */
export function getBranches(): Branch[] {
  if (USE_API) ensureLoaded();
  else hydrate();
  return branches;
}

export function getBranchById(id?: number | null): Branch | undefined {
  if (id == null) return undefined;
  if (USE_API) ensureLoaded();
  else hydrate();
  return branches.find((b) => b.id === id);
}

export type NewBranch = Omit<Branch, "id" | "createdAt">;

export async function addBranch(data: NewBranch): Promise<Branch | undefined> {
  if (USE_API) {
    const created = await apiCreateBranch(data);
    await reload();
    return created;
  }
  const id = Math.max(0, ...branches.map((b) => b.id)) + 1;
  const created: Branch = {
    ...data,
    id,
    createdAt: new Date().toISOString().slice(0, 10),
  };
  branches = withExclusiveCoverage([...branches, created], id, data.coverageThanas);
  emit();
  return created;
}

export async function updateBranch(
  id: number,
  patch: Partial<Branch>,
): Promise<void> {
  if (USE_API) {
    await apiUpdateBranch(id, patch);
    await reload();
    return;
  }
  let next = branches.map((b) => (b.id === id ? { ...b, ...patch } : b));
  if (patch.coverageThanas) {
    next = withExclusiveCoverage(next, id, patch.coverageThanas);
  }
  branches = next;
  emit();
}

export async function toggleBranchActive(id: number): Promise<void> {
  if (USE_API) {
    await apiToggleBranch(id);
    await reload();
    return;
  }
  branches = branches.map((b) =>
    b.id === id ? { ...b, isActive: !b.isActive } : b,
  );
  emit();
}

// Ensure the given thanas belong only to `ownerId` (removed from other hubs).
// Mock-mode only; the API enforces this server-side.
function withExclusiveCoverage(
  list: Branch[],
  ownerId: number,
  thanas: string[],
): Branch[] {
  const claimed = new Set(thanas);
  return list.map((b) =>
    b.id === ownerId
      ? b
      : { ...b, coverageThanas: b.coverageThanas.filter((t) => !claimed.has(t)) },
  );
}

export function useBranches(): Branch[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
