"use client";

import { useAuth } from "@/hooks/useAuth";
import { useDeliveryMen } from "@/lib/deliveryman-store";
import type { DeliveryMan, Parcel } from "@/types";

// Resolves the logged-in rider and scopes every page to their own tasks.
// `loading` is true until the session is read from storage on mount — pages
// must wait for it before deciding a parcel is out of scope (otherwise they
// 404 on first render while deliveryManId is still null).
export function useRiderScope(): {
  deliveryManId: number | null;
  rider: DeliveryMan | null;
  loading: boolean;
} {
  const { deliveryManId, loading } = useAuth();
  const people = useDeliveryMen();
  const rider = people.find((d) => d.id === deliveryManId) ?? null;
  return { deliveryManId: deliveryManId ?? null, rider, loading };
}

export function parcelForRider(p: Parcel, deliveryManId: number): boolean {
  return p.deliveryManId === deliveryManId;
}

// Group a rider's parcel into a task bucket.
//  pickup    — awaiting collection from the merchant (status pending).
//  transit   — picked up and moving through the hub chain; the rider's job is
//              done for now (NOT an active delivery task).
//  deliver   — a FINAL-delivery task: out for delivery, or resting at its
//              destination hub ready to go out (assigned by the destination hub).
//  delivered — completed.  failed — returned / cancelled.
export type RiderTask = "pickup" | "transit" | "deliver" | "delivered" | "failed";

export function riderTaskOf(p: Parcel): RiderTask {
  if (p.status === "pending") return "pickup";
  if (p.status === "delivered" || p.status === "partially_delivered") return "delivered";
  if (["returned", "return_in_transit", "cancelled"].includes(p.status)) return "failed";
  if (p.status === "out_for_delivery") return "deliver";
  // A parcel is only a delivery task once it has reached its destination hub.
  const atDestination =
    p.currentBranchId != null && p.currentBranchId === p.destinationBranchId;
  if (atDestination && ["at_hub", "picked_up", "in_transit"].includes(p.status)) {
    return "deliver";
  }
  return "transit"; // picked up / in the hub chain — handed off, not yet a delivery
}
