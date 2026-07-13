import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import type {
  AvailablePaymentMethod,
  MerchantPayoutMethod,
  WithdrawalRequest,
  WithdrawalStatus,
  Paginated,
} from "@/types";

// Admin-managed methods
export const listPaymentMethods = (pageSize = 100) =>
  apiGet<Paginated<AvailablePaymentMethod>>("/payment-methods/", { pageSize });

export const createPaymentMethod = (data: Partial<AvailablePaymentMethod>) =>
  apiPost<AvailablePaymentMethod>("/payment-methods/", data);

export const updatePaymentMethod = (id: number, data: Partial<AvailablePaymentMethod>) =>
  apiPatch<AvailablePaymentMethod>(`/payment-methods/${id}/`, data);

export const togglePaymentMethod = (id: number) =>
  apiPatch<AvailablePaymentMethod>(`/payment-methods/${id}/toggle/`, {});

// Merchant payout methods
export const listPayoutMethods = (pageSize = 100) =>
  apiGet<Paginated<MerchantPayoutMethod>>("/payout-methods/", { pageSize });

export const addPayoutMethod = (data: Record<string, unknown>) =>
  apiPost<MerchantPayoutMethod>("/payout-methods/", data);

export const removePayoutMethod = (id: number) => apiDelete<void>(`/payout-methods/${id}/`);

export const setDefaultPayoutMethod = (id: number) =>
  apiPatch<MerchantPayoutMethod>(`/payout-methods/${id}/default/`, {});

// Withdrawals
export const listWithdrawals = (params?: { status?: string; pageSize?: number }) =>
  apiGet<Paginated<WithdrawalRequest>>("/withdrawals/", {
    status: params?.status,
    pageSize: params?.pageSize ?? 100,
  });

export const createWithdrawal = (data: { amount: number; payoutMethodId: number }) =>
  apiPost<WithdrawalRequest>("/withdrawals/", data);

export const setWithdrawalStatus = (
  id: number,
  status: WithdrawalStatus,
  extra?: { reference?: string; note?: string },
) => apiPatch<WithdrawalRequest>(`/withdrawals/${id}/status/`, { status, ...extra });
