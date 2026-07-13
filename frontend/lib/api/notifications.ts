import { apiGet, apiPost } from "@/lib/api";
import type { RiderNotification, Paginated } from "@/types";

export const listNotifications = (pageSize = 100) =>
  apiGet<Paginated<RiderNotification>>("/notifications/", { pageSize });

export const markNotificationRead = (id: number) =>
  apiPost<RiderNotification>(`/notifications/${id}/read/`, {});

export const markAllNotificationsRead = () =>
  apiPost<{ detail: string }>("/notifications/read-all/", {});
