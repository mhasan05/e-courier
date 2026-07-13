import { apiGet, apiPost } from "@/lib/api";

export interface TripItem {
  parcelId: number;
  trackingId: string;
  recipientName: string;
  recipientPhone: string;
  recipientAddress: string;
  upazila: string;
  district: string;
  direction: "delivery" | "pickup";
  outcome: "pending" | "delivered" | "partial" | "failed" | "picked_up";
  codAmount: number;
  collectedCod: number;
  failureReason: string;
}

export interface Trip {
  id: number;
  tripId: string;
  status: "in_progress" | "closed";
  riderId: number;
  riderName: string | null;
  branchId: number | null;
  branchName: string | null;
  expectedCod: number;
  dueCod: number;
  collectedCod: number;
  codReconciled: boolean;
  startedAt: string;
  closedAt: string | null;
  items: TripItem[];
}

export interface AvailablePickup {
  parcelId: number;
  trackingId: string;
  recipientName: string;
  codAmount: number;
  merchantName: string;
  pickupAddress: string;
}

export interface ActiveTrip {
  trip: Trip | null;
  availablePickups: AvailablePickup[];
  readyForDelivery: number;
}

export interface CloseSummary {
  expected: number;
  due: number;
  collected: number;
  short: number;
  reconciled: boolean;
}

export const getActiveTrip = () => apiGet<ActiveTrip>("/trips/active/");
export const listTrips = (status?: string) =>
  apiGet<Trip[]>("/trips/", status ? { status } : undefined);
export const openTrip = () => apiPost<Trip>("/trips/", {});
export const tripDeliver = (
  id: number,
  parcelId: number,
  otp: string,
  collectedCod?: number,
) => apiPost<Trip>(`/trips/${id}/deliver/`, { parcelId, otp, collectedCod });
export const tripFail = (id: number, parcelId: number, reason: string) =>
  apiPost<Trip>(`/trips/${id}/fail/`, { parcelId, reason });
export const tripPickup = (id: number, parcelId: number) =>
  apiPost<Trip>(`/trips/${id}/pickup/`, { parcelId });
export const tripClose = (id: number, cashHandedIn: number) =>
  apiPost<{ trip: Trip; summary: CloseSummary }>(`/trips/${id}/close/`, { cashHandedIn });
