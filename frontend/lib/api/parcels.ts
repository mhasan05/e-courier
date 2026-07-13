import { apiGet, apiPost, api } from "@/lib/api";
import type { Parcel, ParcelStatus, Paginated } from "@/types";
import type { RecipientStats } from "@/lib/recipient-stats";

export const listParcels = (params?: { q?: string; status?: string; page?: number; pageSize?: number }) =>
  apiGet<Paginated<Parcel>>("/parcels/", {
    q: params?.q,
    status: params?.status,
    page: params?.page,
    pageSize: params?.pageSize ?? 50,
  });

export const getParcel = (id: number) => apiGet<Parcel>(`/parcels/${id}/`);

export const bookParcel = (data: Record<string, unknown>) =>
  apiPost<Parcel>("/parcels/", data);

export interface StatusUpdate {
  status: ParcelStatus;
  remark?: string;
  otp?: string;
  collectedCod?: number;
  proofNote?: string;
}

// JSON status update (no photo).
export const setParcelStatus = (id: number, body: StatusUpdate) =>
  apiPost<Parcel>(`/parcels/${id}/status/`, body);

// Multipart status update (with proof photo).
export const setParcelStatusForm = (id: number, form: FormData) =>
  api<Parcel>(`/parcels/${id}/status/`, { method: "POST", body: form });

export const assignParcel = (id: number, deliveryManId: number) =>
  apiPost<Parcel>(`/parcels/${id}/assign/`, { deliveryManId });

export const dispatchParcel = (id: number) => apiPost<Parcel>(`/parcels/${id}/dispatch/`, {});

export const acceptParcel = (id: number) => apiPost<Parcel>(`/parcels/${id}/accept/`, {});

export const submitParcelToHub = (id: number) =>
  apiPost<Parcel>(`/parcels/${id}/submit-to-hub/`, {});

export const rejectParcel = (id: number, reason: string) =>
  apiPost<Parcel>(`/parcels/${id}/reject/`, { reason });

export const returnParcel = (id: number, reason: string) =>
  apiPost<Parcel>(`/parcels/${id}/return/`, { reason });

export const trackParcel = (trackingId: string) =>
  apiGet<Record<string, unknown>>(`/track/${encodeURIComponent(trackingId)}/`);

export const recipientStats = (phone: string, excludeParcelId?: number) =>
  apiGet<RecipientStats>("/parcels/recipient-stats/", {
    phone,
    excludeParcelId,
  });

export const importParcels = (form: FormData) =>
  api<{ created: number; trackingIds: string[]; errors: { row: number; error: string }[] }>(
    "/parcels/import/",
    { method: "POST", body: form },
  );
