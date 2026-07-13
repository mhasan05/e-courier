import { apiGet, apiPatch, api } from "@/lib/api";
import type { SupportTicket, SupportStatus, SupportPriority, Paginated } from "@/types";

export const listTickets = (params?: { q?: string; status?: string; pageSize?: number }) =>
  apiGet<Paginated<SupportTicket>>("/support/tickets/", {
    q: params?.q,
    status: params?.status,
    pageSize: params?.pageSize ?? 100,
  });

export const getTicket = (id: number) => apiGet<SupportTicket>(`/support/tickets/${id}/`);

// New ticket (multipart — may include an attachment).
export const createTicket = (form: FormData) =>
  api<SupportTicket>("/support/tickets/", { method: "POST", body: form });

// Reply (multipart — may include an attachment).
export const addTicketMessage = (id: number, form: FormData) =>
  api<SupportTicket>(`/support/tickets/${id}/messages/`, { method: "POST", body: form });

export const setTicket = (id: number, data: { status?: SupportStatus; priority?: SupportPriority }) =>
  apiPatch<SupportTicket>(`/support/tickets/${id}/`, data);

export const markTicketRead = (id: number) =>
  api<SupportTicket>(`/support/tickets/${id}/read/`, { method: "POST" });
