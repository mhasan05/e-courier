// Authenticated fetch client for the Django API. JWT access/refresh tokens are
// kept in localStorage; a 401 transparently refreshes once and retries.
//
// Enabled only when NEXT_PUBLIC_API_URL is set — otherwise the app keeps using
// the in-memory mock stores, so migration can happen store-by-store.

const BASE = process.env.NEXT_PUBLIC_API_URL || "";
const ACCESS_KEY = "cms_access";
const REFRESH_KEY = "cms_refresh";

export function apiEnabled(): boolean {
  return Boolean(BASE);
}

export function getAccess(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(ACCESS_KEY);
}

function getRefresh(): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(REFRESH_KEY);
}

export function setTokens(access: string, refresh?: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(ACCESS_KEY, access);
  if (refresh) window.localStorage.setItem(REFRESH_KEY, refresh);
}

export function clearTokens(): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(ACCESS_KEY);
  window.localStorage.removeItem(REFRESH_KEY);
}

export class ApiError extends Error {
  status: number;
  errors: Record<string, string[]>;
  constructor(status: number, detail: string, errors: Record<string, string[]> = {}) {
    super(detail);
    this.status = status;
    this.errors = errors;
  }
}

interface RequestOptions {
  method?: string;
  body?: unknown; // JSON object or FormData
  auth?: boolean; // attach access token (default true)
  query?: Record<string, string | number | undefined>;
}

async function refreshAccess(): Promise<boolean> {
  const refresh = getRefresh();
  if (!refresh) return false;
  const res = await fetch(`${BASE}/auth/refresh/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ refresh }),
  });
  if (!res.ok) return false;
  const data = await res.json();
  if (data.access) {
    setTokens(data.access, data.refresh);
    return true;
  }
  return false;
}

function buildUrl(path: string, query?: RequestOptions["query"]): string {
  const url = new URL(`${BASE}${path}`);
  if (query) {
    Object.entries(query).forEach(([k, v]) => {
      if (v !== undefined && v !== null) url.searchParams.set(k, String(v));
    });
  }
  return url.toString();
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = true, query } = opts;
  const isForm = typeof FormData !== "undefined" && body instanceof FormData;

  const run = async (): Promise<Response> => {
    const headers: Record<string, string> = {};
    if (!isForm && body !== undefined) headers["Content-Type"] = "application/json";
    if (auth) {
      const token = getAccess();
      if (token) headers["Authorization"] = `Bearer ${token}`;
    }
    return fetch(buildUrl(path, query), {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    });
  };

  let res = await run();
  if (res.status === 401 && auth && (await refreshAccess())) {
    res = await run();
  }

  if (res.status === 204) return undefined as T;

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const detail = (data && data.detail) || res.statusText;
    throw new ApiError(res.status, detail, (data && data.errors) || {});
  }
  return data as T;
}

// Convenience verbs.
export const apiGet = <T>(path: string, query?: RequestOptions["query"]) =>
  api<T>(path, { method: "GET", query });
export const apiPost = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "POST", body });
export const apiPatch = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PATCH", body });
export const apiPut = <T>(path: string, body?: unknown) =>
  api<T>(path, { method: "PUT", body });
export const apiDelete = <T>(path: string) => api<T>(path, { method: "DELETE" });
