import { apiGet } from "@/lib/api";

export interface DashboardData {
  role: string;
  totalParcels: number;
  statusBreakdown: Record<string, number>;
  dailyVolume: { date: string; count: number }[];
  deliveredToday: number;
  ongoing: number;
  // role-specific (optional)
  activeMerchants?: number;
  pendingCod?: number;
  openTickets?: number;
  balance?: number;
  codPending?: number;
  cancelled?: number;
  riders?: number;
  cashInHand?: number;
  toPickUp?: number;
  toDeliver?: number;
  delivered?: number;
}

export const getDashboard = () => apiGet<DashboardData>("/reports/dashboard/");
