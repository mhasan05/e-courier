"use client";

import { useSyncExternalStore } from "react";
import availableSeed from "@/lib/mock-data/payment-methods.json";
import payoutSeed from "@/lib/mock-data/merchant-payout-methods.json";
import withdrawalSeed from "@/lib/mock-data/withdrawals.json";
import { persistList } from "@/lib/persist";
import { apiEnabled } from "@/lib/api";
import * as payApi from "@/lib/api/payments";
import type {
  AvailablePaymentMethod,
  MerchantPayoutMethod,
  WithdrawalRequest,
  WithdrawalStatus,
} from "@/types";

// Payments stores. Read from the Django API when configured; fall back to the
// in-memory mock seed otherwise. Admin manages available methods; merchants
// configure payout accounts and place withdrawals.

const USE_API = apiEnabled();

interface Paged<T> {
  results?: T[];
}

function createStore<T extends { id: number }>(
  name: string,
  seed: T[],
  loader?: () => Promise<Paged<T> | T[]>,
) {
  const useApi = USE_API && !!loader;
  let data: T[] = useApi ? [] : [...seed];
  const listeners = new Set<() => void>();
  const notify = () => listeners.forEach((l) => l());
  const { persist, hydrate } = persistList<T>(
    name,
    () => data,
    (next) => {
      data = next;
    },
    notify,
  );
  let loaded = false;
  const reload = () =>
    loader!()
      .then((res) => {
        data = (res as Paged<T>).results ?? (res as T[]);
        notify();
      })
      .catch(() => {});
  const ensureLoaded = () => {
    if (!useApi || loaded || typeof window === "undefined") return;
    loaded = true;
    void reload();
  };
  ensureLoaded();
  return {
    useApi,
    get: () => {
      if (useApi) ensureLoaded();
      else hydrate();
      return data;
    },
    setMock: (next: T[]) => {
      data = next;
      persist();
      notify();
    },
    reload,
    subscribe: (l: () => void) => {
      listeners.add(l);
      if (useApi) ensureLoaded();
      else hydrate();
      return () => listeners.delete(l);
    },
  };
}

const availableStore = createStore(
  "payment-methods",
  availableSeed as AvailablePaymentMethod[],
  () => payApi.listPaymentMethods(200),
);
const payoutStore = createStore(
  "merchant-payout-methods",
  payoutSeed as MerchantPayoutMethod[],
  () => payApi.listPayoutMethods(200),
);
const withdrawalStore = createStore(
  "withdrawals",
  withdrawalSeed as WithdrawalRequest[],
  () => payApi.listWithdrawals({ pageSize: 200 }),
);

const nextId = (arr: { id: number }[]) => Math.max(0, ...arr.map((x) => x.id)) + 1;

// ---- Available payment methods (admin-managed) ----

export function useAvailableMethods(): AvailablePaymentMethod[] {
  return useSyncExternalStore(availableStore.subscribe, availableStore.get, availableStore.get);
}

export async function addAvailableMethod(
  data: Omit<AvailablePaymentMethod, "id" | "isActive">,
): Promise<void> {
  if (availableStore.useApi) {
    await payApi.createPaymentMethod(data);
    await availableStore.reload();
    return;
  }
  availableStore.setMock([
    ...availableStore.get(),
    { ...data, id: nextId(availableStore.get()), isActive: true },
  ]);
}

export async function updateAvailableMethod(
  id: number,
  patch: Partial<AvailablePaymentMethod>,
): Promise<void> {
  if (availableStore.useApi) {
    await payApi.updatePaymentMethod(id, patch);
    await availableStore.reload();
    return;
  }
  availableStore.setMock(
    availableStore.get().map((m) => (m.id === id ? { ...m, ...patch } : m)),
  );
}

export async function toggleAvailableMethod(id: number): Promise<void> {
  if (availableStore.useApi) {
    await payApi.togglePaymentMethod(id);
    await availableStore.reload();
    return;
  }
  availableStore.setMock(
    availableStore.get().map((m) => (m.id === id ? { ...m, isActive: !m.isActive } : m)),
  );
}

// ---- Merchant payout methods ----

export function usePayoutMethods(): MerchantPayoutMethod[] {
  return useSyncExternalStore(payoutStore.subscribe, payoutStore.get, payoutStore.get);
}

export async function addPayoutMethod(
  data: Omit<MerchantPayoutMethod, "id">,
): Promise<void> {
  if (payoutStore.useApi) {
    await payApi.addPayoutMethod({
      methodId: data.methodId,
      methodName: data.methodName,
      type: data.type,
      accountName: data.accountName,
      accountNumber: data.accountNumber,
      bankName: data.bankName,
      isDefault: data.isDefault,
    });
    await payoutStore.reload();
    return;
  }
  let list = payoutStore.get();
  const isFirst = !list.some((p) => p.merchantId === data.merchantId);
  const method = { ...data, id: nextId(list), isDefault: data.isDefault || isFirst };
  if (method.isDefault) {
    list = list.map((p) =>
      p.merchantId === data.merchantId ? { ...p, isDefault: false } : p,
    );
  }
  payoutStore.setMock([...list, method]);
}

export async function removePayoutMethod(id: number): Promise<void> {
  if (payoutStore.useApi) {
    await payApi.removePayoutMethod(id);
    await payoutStore.reload();
    return;
  }
  payoutStore.setMock(payoutStore.get().filter((p) => p.id !== id));
}

export async function setDefaultPayoutMethod(
  id: number,
  merchantId: number,
): Promise<void> {
  if (payoutStore.useApi) {
    await payApi.setDefaultPayoutMethod(id);
    await payoutStore.reload();
    return;
  }
  payoutStore.setMock(
    payoutStore.get().map((p) =>
      p.merchantId === merchantId ? { ...p, isDefault: p.id === id } : p,
    ),
  );
}

// ---- Withdrawal requests ----

export function useWithdrawals(): WithdrawalRequest[] {
  return useSyncExternalStore(withdrawalStore.subscribe, withdrawalStore.get, withdrawalStore.get);
}

export async function addWithdrawal(
  data: Omit<WithdrawalRequest, "id" | "status" | "requestedAt">,
): Promise<void> {
  if (withdrawalStore.useApi) {
    await payApi.createWithdrawal({
      amount: data.amount,
      payoutMethodId: data.payoutMethodId,
    });
    await withdrawalStore.reload();
    return;
  }
  withdrawalStore.setMock([
    {
      ...data,
      id: nextId(withdrawalStore.get()),
      status: "pending",
      requestedAt: new Date().toISOString().slice(0, 10),
    },
    ...withdrawalStore.get(),
  ]);
}

export async function setWithdrawalStatus(
  id: number,
  status: WithdrawalStatus,
  extra: { reference?: string; note?: string } = {},
): Promise<void> {
  if (withdrawalStore.useApi) {
    await payApi.setWithdrawalStatus(id, status, extra);
    await withdrawalStore.reload();
    return;
  }
  withdrawalStore.setMock(
    withdrawalStore.get().map((w) =>
      w.id === id
        ? {
            ...w,
            status,
            processedAt: new Date().toISOString().slice(0, 10),
            ...extra,
          }
        : w,
    ),
  );
}
