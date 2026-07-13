import { apiGet, apiPost, apiPut, apiDelete } from "@/lib/api";
import type { Zone, Paginated, DeliveryType } from "@/types";

export interface ChargeQuote {
  zoneName: string;
  deliveryCharge: number;
  codCharge: number;
  totalCharge: number;
}

export const listZones = (pageSize = 100) =>
  apiGet<Paginated<Zone>>("/zones/", { pageSize });

export const createZone = (data: Partial<Zone>) => apiPost<Zone>("/zones/", data);

export const updateZone = (id: number, data: Partial<Zone>) =>
  apiPut<Zone>(`/zones/${id}/`, data);

export const deleteZone = (id: number) => apiDelete<void>(`/zones/${id}/`);

export const quote = (input: {
  district: string;
  deliveryType: DeliveryType;
  weight: number;
  codAmount: number;
}) => apiPost<ChargeQuote>("/pricing/quote/", input);
