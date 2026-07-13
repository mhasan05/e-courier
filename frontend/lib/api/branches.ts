import { apiGet, apiPost, apiPatch, apiPut } from "@/lib/api";
import type { Branch, Paginated } from "@/types";

export const listBranches = (params?: { active?: boolean; pageSize?: number }) =>
  apiGet<Paginated<Branch>>("/branches/", {
    active: params?.active ? "true" : undefined,
    pageSize: params?.pageSize ?? 100,
  });

export const getBranch = (id: number) => apiGet<Branch>(`/branches/${id}/`);

export const createBranch = (data: Partial<Branch>) => apiPost<Branch>("/branches/", data);

export const updateBranch = (id: number, data: Partial<Branch>) =>
  apiPut<Branch>(`/branches/${id}/`, data);

export const toggleBranch = (id: number) =>
  apiPatch<Branch>(`/branches/${id}/toggle-active/`, {});

// Hub manager: read / set their own hub's coverage areas ("District/Thana" keys).
export interface MyCoverage {
  branchId: number;
  branchName: string;
  coverageThanas: string[];
}
export const getMyCoverage = () => apiGet<MyCoverage>("/branches/my-coverage/");
export const setMyCoverage = (coverageThanas: string[]) =>
  apiPut<MyCoverage>("/branches/my-coverage/", { coverageThanas });
export const renameCoverageArea = (oldKey: string, newKey: string) =>
  apiPost<MyCoverage>("/branches/my-coverage/", { oldKey, newKey });
