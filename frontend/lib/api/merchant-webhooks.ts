import { apiGet, apiPut } from "@/lib/api";

export interface Webhook {
  url: string;
  authToken: string;
  isActive: boolean;
  createdAt: string | null;
}

export interface WebhookDelivery {
  id: number;
  event: string; // notification_type: "delivery_status" | "tracking_update"
  trackingId: string;
  ok: boolean;
  statusCode: number | null;
  error: string;
  createdAt: string;
}

export const getWebhook = () => apiGet<Webhook>("/merchant/webhook/");

export const saveWebhook = (payload: {
  url: string;
  authToken: string;
  isActive: boolean;
}) => apiPut<Webhook>("/merchant/webhook/", payload);

export const listWebhookDeliveries = () =>
  apiGet<WebhookDelivery[]>("/merchant/webhook/deliveries/");
