"use client";

import { useSyncExternalStore } from "react";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import {
  listNotifications,
  markNotificationRead as apiMarkRead,
  markAllNotificationsRead as apiMarkAllRead,
} from "@/lib/api/notifications";
import type { RiderNotification } from "@/types";

// Rider notifications. Reads from the API when configured (the server creates
// them on assignment/handover and pushes over the notifications WebSocket);
// falls back to the in-memory mock seed otherwise.

const USE_API = apiEnabled();

let items: RiderNotification[] = [];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<RiderNotification>(
  "rider-notifications",
  () => items,
  (next) => {
    items = next;
  },
  notify,
);

let loaded = false;
function reload(): Promise<void> {
  return listNotifications(200)
    .then((res) => {
      items = res.results ?? (res as unknown as RiderNotification[]);
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

// Called by the notifications WebSocket to pull the latest live.
export function refreshNotifications(): void {
  if (USE_API) void reload();
}

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
const getSnapshot = () => items;

export function useRiderNotifications(): RiderNotification[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

// Mock-only: the API creates notifications server-side (on assignment etc.).
export function pushRiderNotification(
  data: Omit<RiderNotification, "id" | "read" | "createdAt">,
): void {
  if (USE_API) return;
  hydrate();
  const id = Math.max(0, ...items.map((n) => n.id)) + 1;
  items = [
    { ...data, id, read: false, createdAt: new Date().toISOString() },
    ...items,
  ];
  emit();
}

export async function markRiderNotificationRead(id: number): Promise<void> {
  if (USE_API) {
    await apiMarkRead(id);
    await reload();
    return;
  }
  items = items.map((n) => (n.id === id ? { ...n, read: true } : n));
  emit();
}

export async function markAllRiderNotificationsRead(riderId: number): Promise<void> {
  if (USE_API) {
    await apiMarkAllRead();
    await reload();
    return;
  }
  items = items.map((n) => (n.riderId === riderId ? { ...n, read: true } : n));
  emit();
}

export function notificationsForRider(
  list: RiderNotification[],
  riderId: number,
): RiderNotification[] {
  return list
    .filter((n) => n.riderId === riderId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function unreadCountForRider(
  list: RiderNotification[],
  riderId: number,
): number {
  return list.filter((n) => n.riderId === riderId && !n.read).length;
}
