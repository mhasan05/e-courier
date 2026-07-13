import { getAccess } from "@/lib/api";

// Open an authenticated WebSocket to the Django Channels backend. Derives the ws
// origin from NEXT_PUBLIC_API_URL (…/api/v1 → ws(s)://host/ws/...).
function wsBase(): string | null {
  const apiUrl = process.env.NEXT_PUBLIC_API_URL;
  if (!apiUrl) return null;
  try {
    const u = new URL(apiUrl);
    const proto = u.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${u.host}`;
  } catch {
    return null;
  }
}

/** Open a WS to `path` (e.g. "/ws/notifications/"), authenticated via ?token=. */
export function openSocket(path: string): WebSocket | null {
  const base = wsBase();
  const token = getAccess();
  if (!base || !token) return null;
  const sep = path.includes("?") ? "&" : "?";
  return new WebSocket(`${base}${path}${sep}token=${encodeURIComponent(token)}`);
}

export function notificationsSocket(): WebSocket | null {
  return openSocket("/ws/notifications/");
}

export function ticketSocket(ticketId: number): WebSocket | null {
  return openSocket(`/ws/support/${ticketId}/`);
}
