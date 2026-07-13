import { apiGet, apiPost, apiPatch } from "@/lib/api";
import type { Paginated } from "@/types";

// A hub (branch) manager account and the hub it's assigned to.
export interface HubManager {
  id: number;
  name: string;
  email: string;
  branchId: number | null;
  branchName: string | null;
  isActive: boolean;
}

export const listManagers = (pageSize = 100) =>
  apiGet<Paginated<HubManager>>("/accounts/managers/", { pageSize });

export const createManager = (data: {
  name: string;
  email: string;
  password: string;
  branchId?: number | null;
}) => apiPost<HubManager>("/accounts/managers/", data);

export const updateManager = (
  id: number,
  data: { name?: string; branchId?: number | null; isActive?: boolean },
) => apiPatch<HubManager>(`/accounts/managers/${id}/`, data);
