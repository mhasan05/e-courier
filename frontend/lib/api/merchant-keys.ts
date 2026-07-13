import { apiGet, apiPost, apiDelete } from "@/lib/api";

export interface ApiKey {
  id: number;
  label: string;
  apiKey: string; // public identifier (Api-Key header) — safe to display
  isActive: boolean;
  lastUsedAt: string | null;
  createdAt: string;
}

// Returned only at creation — includes the Secret-Key (shown once).
export interface CreatedApiKey extends ApiKey {
  secretKey: string;
}

export const listApiKeys = () => apiGet<ApiKey[]>("/merchant/api-keys/");

export const createApiKey = (label: string) =>
  apiPost<CreatedApiKey>("/merchant/api-keys/", { label });

export const revokeApiKey = (id: number) =>
  apiDelete<void>(`/merchant/api-keys/${id}/`);
