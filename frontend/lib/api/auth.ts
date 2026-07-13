import { apiGet, apiPost, api, setTokens, clearTokens } from "@/lib/api";
import type { Role } from "@/types";

export interface ApiUser {
  id: number;
  email: string;
  name: string;
  role: Role;
  avatarUrl: string | null;
  branchId: number | null;
  merchantId: number | null;
  deliveryManId: number | null;
}

interface LoginResponse {
  access: string;
  refresh: string;
  user: ApiUser;
}

// Logs in with email-or-phone + password. Stores JWT tokens and returns the user.
export async function login(identifier: string, password: string): Promise<ApiUser> {
  const data = await api<LoginResponse>("/auth/login/", {
    method: "POST",
    auth: false,
    body: { email: identifier, password },
  });
  setTokens(data.access, data.refresh);
  return data.user;
}

export function logout(): void {
  clearTokens();
}

export const me = () => apiGet<ApiUser>("/auth/me/");

export const changePassword = (current_password: string, new_password: string) =>
  apiPost<{ detail: string }>("/auth/change-password/", { current_password, new_password });
