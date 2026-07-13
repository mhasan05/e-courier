import { apiGet, apiPost } from "@/lib/api";
import type { HubRemittance, RiderHandover, Paginated } from "@/types";

// Rider → hub handovers
export const listHandovers = (pageSize = 100) =>
  apiGet<Paginated<RiderHandover>>("/cod/handovers/", { pageSize });

export const createHandover = () => apiPost<RiderHandover>("/cod/handovers/", {});

export const confirmHandover = (id: number) =>
  apiPost<RiderHandover>(`/cod/handovers/${id}/confirm/`, {});

export const cashInHand = () =>
  apiGet<{ amount: number; parcelCount: number; parcelIds: number[] }>("/cod/cash-in-hand/");

// Hub → HQ remittances
export const listRemittances = (pageSize = 100) =>
  apiGet<Paginated<HubRemittance>>("/cod/remittances/", { pageSize });

export const createRemittance = (data: { amount: number; reference?: string; note?: string; branchId?: number }) =>
  apiPost<HubRemittance>("/cod/remittances/", data);

export const confirmRemittance = (id: number) =>
  apiPost<HubRemittance>(`/cod/remittances/${id}/confirm/`, {});

export const codSummary = (branchId?: number) =>
  apiGet<{ branchId: number; collected: number; sent: number; outstanding: number }>(
    "/cod/summary/",
    { branchId },
  );
