"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/support-tickets.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import * as supportApi from "@/lib/api/support";
import type {
  SupportTicket,
  SupportMessage,
  SupportStatus,
  SupportPriority,
} from "@/types";

// Support-ticket store. Reads from the Django API when configured; falls back
// to the in-memory mock seed otherwise. Live message pushes arrive over the
// ticket WebSocket (see TicketThread) which calls refreshTickets().

const USE_API = apiEnabled();

let tickets: SupportTicket[] = USE_API ? [] : (seed as SupportTicket[]);
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<SupportTicket>(
  "support",
  () => tickets,
  (next) => {
    tickets = next;
  },
  notify,
);

let loaded = false;
// True once the initial API fetch has settled (see parcel-store for rationale).
let ready = !USE_API;
function reload(): Promise<void> {
  return supportApi
    .listTickets({ pageSize: 200 })
    .then((res) => {
      tickets = res.results ?? (res as unknown as SupportTicket[]);
      notify();
    })
    .catch(() => {})
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

// Called by the ticket WebSocket to pull the latest messages/status live.
export function refreshTickets(): void {
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
const getSnapshot = () => tickets;

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

export function useTickets(): SupportTicket[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True once the initial API fetch has settled. */
export function useTicketsReady(): boolean {
  return useSyncExternalStore(subscribe, () => ready, () => ready);
}

export function getTicketById(id: number): SupportTicket | undefined {
  if (USE_API) ensureLoaded();
  else hydrate();
  return tickets.find((t) => t.id === id);
}

const nextTicketId = () => Math.max(0, ...tickets.map((t) => t.id)) + 1;
const nextMessageId = (t: SupportTicket) =>
  Math.max(0, ...t.messages.map((m) => m.id)) + 1;

export interface NewTicket {
  merchantId: number;
  merchantName: string;
  subject: string;
  category: SupportTicket["category"];
  priority: SupportPriority;
  trackingId?: string;
  body: string;
  attachment?: string;
}

export async function createTicket(data: NewTicket): Promise<SupportTicket | undefined> {
  if (USE_API) {
    const form = new FormData();
    form.append("subject", data.subject);
    form.append("category", data.category);
    form.append("priority", data.priority);
    if (data.trackingId) form.append("trackingId", data.trackingId);
    form.append("body", data.body);
    if (data.attachment)
      form.append("attachment", await dataUrlToBlob(data.attachment), "attachment.jpg");
    const created = await supportApi.createTicket(form);
    await reload();
    return created;
  }
  hydrate();
  const id = nextTicketId();
  const now = new Date().toISOString();
  const opening: SupportMessage = {
    id: 1,
    sender: "merchant",
    senderName: data.merchantName,
    body: data.body,
    attachment: data.attachment,
    createdAt: now,
  };
  const ticket: SupportTicket = {
    id,
    ref: `TKT-${String(id).padStart(4, "0")}`,
    merchantId: data.merchantId,
    merchantName: data.merchantName,
    subject: data.subject,
    category: data.category,
    priority: data.priority,
    status: "open",
    trackingId: data.trackingId,
    messages: [opening],
    createdAt: now,
    updatedAt: now,
    unreadForAdmin: true,
    unreadForMerchant: false,
  };
  tickets = [ticket, ...tickets];
  emit();
  return ticket;
}

export async function addTicketMessage(
  id: number,
  sender: "merchant" | "admin",
  senderName: string,
  body: string,
  attachment?: string,
): Promise<void> {
  if (USE_API) {
    const form = new FormData();
    if (body) form.append("body", body);
    if (attachment)
      form.append("attachment", await dataUrlToBlob(attachment), "attachment.jpg");
    await supportApi.addTicketMessage(id, form);
    await reload();
    return;
  }
  const now = new Date().toISOString();
  tickets = tickets.map((t) => {
    if (t.id !== id) return t;
    const message: SupportMessage = {
      id: nextMessageId(t),
      sender,
      senderName,
      body,
      attachment,
      createdAt: now,
    };
    let status = t.status;
    if (sender === "admin" && t.status === "open") status = "in_progress";
    if (sender === "merchant" && (t.status === "resolved" || t.status === "closed"))
      status = "open";
    return {
      ...t,
      status,
      messages: [...t.messages, message],
      updatedAt: now,
      unreadForAdmin: sender === "merchant" ? true : t.unreadForAdmin,
      unreadForMerchant: sender === "admin" ? true : t.unreadForMerchant,
    };
  });
  emit();
}

export async function setTicketStatus(id: number, status: SupportStatus): Promise<void> {
  if (USE_API) {
    await supportApi.setTicket(id, { status });
    await reload();
    return;
  }
  tickets = tickets.map((t) =>
    t.id === id ? { ...t, status, updatedAt: new Date().toISOString() } : t,
  );
  emit();
}

export async function setTicketPriority(
  id: number,
  priority: SupportPriority,
): Promise<void> {
  if (USE_API) {
    await supportApi.setTicket(id, { priority });
    await reload();
    return;
  }
  tickets = tickets.map((t) => (t.id === id ? { ...t, priority } : t));
  emit();
}

export async function markTicketRead(
  id: number,
  side: "admin" | "merchant",
): Promise<void> {
  if (USE_API) {
    await supportApi.markTicketRead(id);
    await reload();
    return;
  }
  tickets = tickets.map((t) => {
    if (t.id !== id) return t;
    if (side === "admin" && !t.unreadForAdmin) return t;
    if (side === "merchant" && !t.unreadForMerchant) return t;
    return side === "admin"
      ? { ...t, unreadForAdmin: false }
      : { ...t, unreadForMerchant: false };
  });
  emit();
}

export function ticketsForMerchant(
  list: SupportTicket[],
  merchantId: number,
): SupportTicket[] {
  return list
    .filter((t) => t.merchantId === merchantId)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function openTicketCount(list: SupportTicket[]): number {
  return list.filter((t) => t.status === "open" || t.status === "in_progress")
    .length;
}
