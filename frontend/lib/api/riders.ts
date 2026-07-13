import { apiGet, apiPost, apiPatch, api } from "@/lib/api";
import type { DeliveryMan, DeliveryManStatus, Paginated } from "@/types";

export const listRiders = (params?: { q?: string; status?: string; pageSize?: number }) =>
  apiGet<Paginated<DeliveryMan>>("/riders/", {
    q: params?.q,
    status: params?.status,
    pageSize: params?.pageSize ?? 100,
  });

export const getRider = (id: number) => apiGet<DeliveryMan>(`/riders/${id}/`);

export const getMyRider = () => apiGet<DeliveryMan>("/riders/me/");

export const createRider = (data: Record<string, unknown>) =>
  apiPost<DeliveryMan>("/riders/", data);

export const updateRider = (id: number, data: Record<string, unknown>) =>
  apiPatch<DeliveryMan>(`/riders/${id}/`, data);

export const setRiderStatus = (id: number, status: DeliveryManStatus) =>
  apiPatch<DeliveryMan>(`/riders/${id}/status/`, { status });

export const resetRiderPassword = (id: number, password: string) =>
  apiPost<{ status: string }>(`/riders/${id}/password/`, { password });

export const uploadRiderDocuments = (id: number, files: FormData) =>
  api<DeliveryMan>(`/riders/${id}/documents/`, { method: "PUT", body: files });
