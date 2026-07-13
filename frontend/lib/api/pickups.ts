import { apiGet } from "@/lib/api";
import type { Paginated } from "@/types";

export interface PickupRow {
  merchantId: number;
  merchantName: string;
  phone: string;
  pickupAddress: string;
  district: string;
  hubId: number | null;
  parcelCount: number;
  totalCod: number;
}

export const listPickups = (pageSize = 100) =>
  apiGet<Paginated<PickupRow>>("/pickups/", { pageSize });
