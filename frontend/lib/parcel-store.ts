"use client";

import { useSyncExternalStore } from "react";
import seed from "@/lib/mock-data/parcels.json";
import { nextHopBranchId } from "@/lib/hubs";
import { getBranchById } from "@/lib/branch-store";
import { pushRiderNotification } from "@/lib/notification-store";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import * as parcelApi from "@/lib/api/parcels";
import type { Parcel, ParcelStatus, ParcelStatusEvent, DeliveryProof } from "@/types";

// Parcel store. Reads from the Django API (scoped per role) when configured;
// falls back to the in-memory mock seed otherwise. Hook/function names are
// stable so pages don't change. Custody actions (dispatch/accept/reject) hit
// the verified backend endpoints; the server records the acting user.

const USE_API = apiEnabled();

let parcels: Parcel[] = USE_API ? [] : [...(seed as Parcel[])];
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());
const { persist, hydrate } = persistList<Parcel>(
  "parcels",
  () => parcels,
  (next) => {
    parcels = next;
  },
  notify,
);

let loaded = false;
// `ready` is true once the initial API fetch has settled (success OR failure),
// so consumers can distinguish "still loading" from "loaded but genuinely
// empty". Immediately true in mock mode (seed present synchronously).
let ready = !USE_API;
function reload(): Promise<void> {
  return parcelApi
    .listParcels({ pageSize: 500 })
    .then((res) => {
      parcels = res.results ?? (res as unknown as Parcel[]);
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
  return parcels;
}

async function dataUrlToBlob(dataUrl: string): Promise<Blob> {
  return (await fetch(dataUrl)).blob();
}

// ── Mock helpers (used only when the API is disabled) ───────────────────────
export function generateTrackingId(): string {
  hydrate();
  const year = new Date().getFullYear();
  let id = "";
  do {
    const n = Math.floor(100000 + Math.random() * 900000);
    id = `CMS-${year}-${n}`;
  } while (parcels.some((p) => p.trackingId === id));
  return id;
}

export function nextParcelId(): number {
  return Math.max(0, ...parcels.map((p) => p.id)) + 1;
}

// Mock-only: booking pushes a fully-built parcel. In API mode use bookParcel().
export function addParcel(parcel: Parcel): void {
  hydrate();
  parcels = [parcel, ...parcels];
  emit();
}

// Book a parcel through the API (server computes charges + hub routing + OTP).
export async function bookParcel(
  input: Record<string, unknown>,
): Promise<Parcel | undefined> {
  const created = await parcelApi.bookParcel(input);
  await reload();
  return created;
}

// ── Status / delivery ───────────────────────────────────────────────────────
export async function setParcelStatus(
  id: number,
  status: ParcelStatus,
  remark?: string,
  changedBy = "Merchant",
  proof?: DeliveryProof,
): Promise<void> {
  if (USE_API) {
    if (proof?.photo) {
      const fd = new FormData();
      fd.append("status", status);
      if (remark) fd.append("remark", remark);
      if (proof.note) fd.append("proofNote", proof.note);
      fd.append("proofPhoto", await dataUrlToBlob(proof.photo), "proof.jpg");
      await parcelApi.setParcelStatusForm(id, fd);
    } else {
      await parcelApi.setParcelStatus(id, { status, remark });
    }
    await reload();
    return;
  }
  const event: ParcelStatusEvent = {
    status,
    remark,
    changedBy,
    timestamp: new Date().toISOString(),
    ...(proof && (proof.photo || proof.note) ? { proof } : {}),
  };
  parcels = parcels.map((p) =>
    p.id === id ? { ...p, status, history: [...p.history, event] } : p,
  );
  emit();
}

// Complete a delivery (full or partial) — OTP verified server-side in API mode.
export async function recordDelivery(
  id: number,
  status: "delivered" | "partially_delivered",
  collectedCod: number,
  remark: string,
  changedBy: string,
  proof?: DeliveryProof,
  otp?: string,
): Promise<void> {
  if (USE_API) {
    if (proof?.photo) {
      const fd = new FormData();
      fd.append("status", status);
      fd.append("collectedCod", String(collectedCod));
      if (remark) fd.append("remark", remark);
      if (otp) fd.append("otp", otp);
      if (proof.note) fd.append("proofNote", proof.note);
      fd.append("proofPhoto", await dataUrlToBlob(proof.photo), "proof.jpg");
      await parcelApi.setParcelStatusForm(id, fd);
    } else {
      await parcelApi.setParcelStatus(id, {
        status,
        remark,
        collectedCod,
        otp,
        proofNote: proof?.note,
      });
    }
    await reload();
    return;
  }
  const event: ParcelStatusEvent = {
    status,
    remark,
    changedBy,
    timestamp: new Date().toISOString(),
    ...(proof && (proof.photo || proof.note) ? { proof } : {}),
  };
  parcels = parcels.map((p) =>
    p.id === id
      ? { ...p, status, collectedCod, history: [...p.history, event] }
      : p,
  );
  emit();
}

export function collectedCodOf(p: Parcel): number {
  if (p.status === "delivered") return p.collectedCod ?? p.codAmount;
  if (p.status === "partially_delivered") return p.collectedCod ?? 0;
  return 0;
}

export async function addParcelRemark(
  id: number,
  remark: string,
  changedBy = "Admin",
): Promise<void> {
  if (USE_API) {
    const p = parcels.find((x) => x.id === id);
    if (p) await parcelApi.setParcelStatus(id, { status: p.status, remark });
    await reload();
    return;
  }
  parcels = parcels.map((p) =>
    p.id === id
      ? {
          ...p,
          history: [
            ...p.history,
            { status: p.status, remark, changedBy, timestamp: new Date().toISOString() },
          ],
        }
      : p,
  );
  emit();
}

// ── Assignment ───────────────────────────────────────────────────────────────
export async function assignDeliveryMan(
  id: number,
  deliveryManId: number,
  deliveryManName: string,
  actor = "Admin",
): Promise<void> {
  if (USE_API) {
    await parcelApi.assignParcel(id, deliveryManId);
    await reload();
    return;
  }
  parcels = parcels.map((p) => {
    if (p.id !== id) return p;
    const wasAssigned = p.deliveryManId != null && p.deliveryManId !== deliveryManId;
    pushRiderNotification({
      riderId: deliveryManId,
      type: wasAssigned ? "reassignment" : "assignment",
      title: wasAssigned ? "Parcel reassigned to you" : "New parcel assigned",
      body: `${p.trackingId} → ${p.recipientName}, ${p.upazila ? p.upazila + ", " : ""}${p.district}`,
      parcelId: p.id,
      trackingId: p.trackingId,
    });
    return {
      ...p,
      deliveryManId,
      history: [
        ...p.history,
        {
          status: p.status,
          remark: `Assigned to delivery man: ${deliveryManName}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  emit();
}

// ── Inter-hub custody handshake ──────────────────────────────────────────────
export async function dispatchParcel(id: number, actor = "Admin"): Promise<boolean> {
  if (USE_API) {
    try {
      await parcelApi.dispatchParcel(id);
      await reload();
      return true;
    } catch {
      return false;
    }
  }
  let moved = false;
  parcels = parcels.map((p) => {
    if (p.id !== id) return p;
    const next = nextHopBranchId(p);
    if (next == null) return p;
    moved = true;
    const hub = getBranchById(next);
    return {
      ...p,
      status: "in_transit" as ParcelStatus,
      history: [
        ...p.history,
        {
          status: "in_transit" as ParcelStatus,
          remark: `Dispatched to ${hub?.name ?? "next hub"}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  if (moved) emit();
  return moved;
}

export async function acceptParcel(id: number, actor = "Admin"): Promise<boolean> {
  if (USE_API) {
    try {
      await parcelApi.acceptParcel(id);
      await reload();
      return true;
    } catch {
      return false;
    }
  }
  let ok = false;
  parcels = parcels.map((p) => {
    if (p.id !== id || p.status !== "in_transit") return p;
    const next = nextHopBranchId(p);
    if (next == null) return p;
    ok = true;
    const hub = getBranchById(next);
    return {
      ...p,
      currentBranchId: next,
      status: "at_hub" as ParcelStatus,
      history: [
        ...p.history,
        {
          status: "at_hub" as ParcelStatus,
          remark: `Received at ${hub?.name ?? "hub"}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  if (ok) emit();
  return ok;
}

// A rider hands a picked-up parcel to the hub: it rests at the hub (at_hub) and
// the rider is released, so the hub can dispatch it onward.
export async function submitToHub(id: number, actor = "Rider"): Promise<boolean> {
  if (USE_API) {
    try {
      await parcelApi.submitParcelToHub(id);
      await reload();
      return true;
    } catch {
      return false;
    }
  }
  let ok = false;
  parcels = parcels.map((p) => {
    if (p.id !== id || p.status !== "picked_up") return p;
    ok = true;
    const hub = getBranchById(p.currentBranchId);
    return {
      ...p,
      status: "at_hub" as ParcelStatus,
      deliveryManId: undefined,
      history: [
        ...p.history,
        {
          status: "at_hub" as ParcelStatus,
          remark: `Submitted to ${hub?.name ?? "hub"}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  if (ok) emit();
  return ok;
}

export async function rejectParcel(
  id: number,
  reason: string,
  actor = "Admin",
): Promise<boolean> {
  if (USE_API) {
    try {
      await parcelApi.rejectParcel(id, reason);
      await reload();
      return true;
    } catch {
      return false;
    }
  }
  let ok = false;
  parcels = parcels.map((p) => {
    if (p.id !== id || p.status !== "in_transit") return p;
    ok = true;
    const from = getBranchById(p.currentBranchId);
    return {
      ...p,
      status: "at_hub" as ParcelStatus,
      history: [
        ...p.history,
        {
          status: "at_hub" as ParcelStatus,
          remark: `Transfer rejected${reason ? `: ${reason}` : ""} — held at ${from?.name ?? "sending hub"}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  if (ok) emit();
  return ok;
}

// Start a return-to-origin (RTO): flip routing back toward the origin hub.
export async function returnParcel(
  id: number,
  reason: string,
  actor = "Hub",
): Promise<boolean> {
  if (USE_API) {
    try {
      await parcelApi.returnParcel(id, reason);
      await reload();
      return true;
    } catch {
      return false;
    }
  }
  let ok = false;
  parcels = parcels.map((p) => {
    if (p.id !== id) return p;
    ok = true;
    return {
      ...p,
      returning: true,
      status: "return_in_transit" as ParcelStatus,
      history: [
        ...p.history,
        {
          status: "return_in_transit" as ParcelStatus,
          remark: `Return initiated${reason ? `: ${reason}` : ""}`,
          changedBy: actor,
          timestamp: new Date().toISOString(),
        },
      ],
    };
  });
  if (ok) emit();
  return ok;
}

// Re-home a merchant's parcels to a new hub. Mock-only; in API mode the server
// owns owner_branch (set at booking), so this is a no-op.
export function reassignMerchantParcels(merchantId: number, branchId: number): void {
  if (USE_API) return;
  let changed = false;
  parcels = parcels.map((p) => {
    if (p.merchantId !== merchantId || p.ownerBranchId === branchId) return p;
    changed = true;
    return { ...p, ownerBranchId: branchId };
  });
  if (changed) emit();
}

/** Reactive hook — components re-render when the store changes. */
export function useParcels(): Parcel[] {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

/** True once the initial API fetch has settled — gate detail views on this
 * before deciding a record is missing, so valid records don't flash a 404. */
export function useParcelsReady(): boolean {
  return useSyncExternalStore(
    subscribe,
    () => ready,
    () => ready,
  );
}
