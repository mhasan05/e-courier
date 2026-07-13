import { apiGet, apiPost } from "@/lib/api";

export interface BagParcel {
  id: number;
  trackingId: string;
  recipientName: string;
  district: string;
  upazila: string;
  codAmount: number;
  destinationBranchId?: number;
}

export interface Bag {
  id: number;
  bagId: string;
  status: "open" | "dispatched" | "received";
  fromBranchId: number | null;
  toBranchId: number | null;
  fromBranchName: string | null;
  toBranchName: string | null;
  parcelCount: number;
  parcels: BagParcel[];
  createdBy: string;
  createdAt: string;
  dispatchedAt: string | null;
  receivedAt: string | null;
}

export interface BaggableGroup {
  toBranchId: number;
  toBranchName: string;
  parcels: BagParcel[];
}

export const listBags = (status?: string) =>
  apiGet<Bag[]>("/bags/", status ? { status } : undefined);

export const baggableGroups = () => apiGet<BaggableGroup[]>("/bags/baggable/");

export const buildBag = (toBranchId: number, parcelIds: number[]) =>
  apiPost<Bag>("/bags/", { toBranchId, parcelIds });

export const dispatchBag = (id: number) => apiPost<Bag>(`/bags/${id}/dispatch/`, {});

export const receiveBag = (id: number) => apiPost<Bag>(`/bags/${id}/receive/`, {});
