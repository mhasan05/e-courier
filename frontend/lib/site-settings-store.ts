"use client";

import { useSyncExternalStore } from "react";
import { apiEnabled } from "@/lib/api";
import * as api from "@/lib/api/site-settings";

// Site-wide branding + contact info the admin controls. Read publicly (needed
// on login/landing) and reflected everywhere the company name/logo/contact show.

export interface SiteSettings {
  companyName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
}

export interface SiteSettingsState extends SiteSettings {
  // False until the real settings have been fetched (or the fetch has
  // failed) — callers should render a skeleton instead of placeholder text
  // while this is false, rather than flashing a fake company name.
  ready: boolean;
}

// Only used when no backend is configured (local demo/dev without an API).
const MOCK_DEFAULTS: SiteSettings = {
  companyName: process.env.NEXT_PUBLIC_APP_NAME || "Courier CMS",
  logoUrl: null,
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
};

const EMPTY: SiteSettings = {
  companyName: "",
  logoUrl: null,
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
};

const USE_API = apiEnabled();
let settings: SiteSettings = USE_API ? EMPTY : MOCK_DEFAULTS;
let ready = !USE_API;
// useSyncExternalStore requires getSnapshot to return a stable reference
// when nothing changed, so the combined {..., ready} object is cached here
// and only rebuilt when the underlying state actually changes.
let snapshot: SiteSettingsState = { ...settings, ready };
const listeners = new Set<() => void>();
const notify = () => {
  snapshot = { ...settings, ready };
  listeners.forEach((l) => l());
};

const RETRY_DELAYS_MS = [2000, 5000, 10000, 20000, 30000]; // then repeats at 30s

let started = false;
let retryAttempt = 0;
let retryTimer: ReturnType<typeof setTimeout> | null = null;

// A transient failure (a dropped tunnel, a cold-starting backend, a blip in
// connectivity) must not strand the UI in the empty pre-load state forever —
// keep retrying with backoff instead of giving up after one attempt.
function reload(): Promise<void> {
  return api
    .getSiteSettings()
    .then((s) => {
      settings = {
        companyName: s.companyName || "",
        logoUrl: s.logoUrl ?? null,
        contactEmail: s.contactEmail ?? "",
        contactPhone: s.contactPhone ?? "",
        contactAddress: s.contactAddress ?? "",
      };
      retryAttempt = 0;
      ready = true;
      notify();
    })
    .catch(() => {
      const delay = RETRY_DELAYS_MS[Math.min(retryAttempt, RETRY_DELAYS_MS.length - 1)];
      retryAttempt += 1;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = setTimeout(() => void reload(), delay);
      // Keep showing the loading skeleton through retries rather than
      // committing to a blank/broken "ready" state after one failed attempt.
    });
}
function ensureLoaded() {
  if (!USE_API || started || typeof window === "undefined") return;
  started = true;
  void reload();
}
ensureLoaded();

const subscribe = (l: () => void) => {
  listeners.add(l);
  ensureLoaded();
  return () => listeners.delete(l);
};
const getSnapshot = (): SiteSettingsState => snapshot;

export function useSiteSettings(): SiteSettingsState {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}

export function getSiteSettings(): SiteSettings {
  ensureLoaded();
  return settings;
}

type TextPatch = Partial<
  Pick<SiteSettings, "companyName" | "contactEmail" | "contactPhone" | "contactAddress">
>;

export async function saveSiteSettings(patch: TextPatch): Promise<void> {
  if (USE_API) {
    await api.updateSiteSettings(patch);
    await reload();
    return;
  }
  settings = { ...settings, ...patch };
  notify();
}

export async function saveSiteLogo(file: File): Promise<void> {
  if (USE_API) {
    const form = new FormData();
    form.append("logo", file);
    await api.updateSiteSettingsLogo(form);
    await reload();
    return;
  }
  settings = { ...settings, logoUrl: URL.createObjectURL(file) };
  notify();
}
