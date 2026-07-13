import type { AuthSession, Role } from "@/types";

// localStorage keys (kept consistent with the M4 backend integration note:
// the real API will store { access, refresh, user } — for M1 we store a
// single mock session object).
const SESSION_KEY = "cms_session";

export function setSession(session: AuthSession): void {
  if (typeof window === "undefined") return;
  localStorage.setItem(SESSION_KEY, JSON.stringify(session));
}

export function getSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  const raw = localStorage.getItem(SESSION_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthSession;
  } catch {
    return null;
  }
}

export function getToken(): string | null {
  return getSession()?.token ?? null;
}

export function clearSession(): void {
  if (typeof window === "undefined") return;
  localStorage.removeItem(SESSION_KEY);
}

export function homeForRole(role: Role): string {
  if (role === "merchant") return "/merchant/dashboard";
  if (role === "branch_manager") return "/branch/dashboard";
  if (role === "delivery_man") return "/rider/dashboard";
  return "/admin/dashboard";
}
