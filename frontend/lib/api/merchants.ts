import { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { Merchant, MerchantStatus, Paginated } from "@/types";

export const listMerchants = (params?: { q?: string; status?: string; pageSize?: number }) =>
  apiGet<Paginated<Merchant>>("/merchants/", {
    q: params?.q,
    status: params?.status,
    pageSize: params?.pageSize ?? 100,
  });

export const getMerchant = (id: number) => apiGet<Merchant>(`/merchants/${id}/`);

export const getMyMerchant = () => apiGet<Merchant>("/merchants/me/");

export const createMerchant = (data: Record<string, unknown>) =>
  apiPost<Merchant>("/merchants/", data);

export const updateMerchant = (id: number, data: Record<string, unknown>) =>
  apiPatch<Merchant>(`/merchants/${id}/`, data);

export const setMerchantStatus = (id: number, status: MerchantStatus) =>
  apiPatch<Merchant>(`/merchants/${id}/status/`, { status });

export const assignMerchantBranch = (id: number, homeBranchId: number) =>
  apiPatch<Merchant>(`/merchants/${id}/assign-branch/`, { homeBranchId });
