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

const DEFAULTS: SiteSettings = {
  companyName: process.env.NEXT_PUBLIC_APP_NAME || "Courier CMS",
  logoUrl: null,
  contactEmail: "",
  contactPhone: "",
  contactAddress: "",
};

const USE_API = apiEnabled();
let settings: SiteSettings = DEFAULTS;
const listeners = new Set<() => void>();
const notify = () => listeners.forEach((l) => l());

let loaded = false;
function reload(): Promise<void> {
  return api
    .getSiteSettings()
    .then((s) => {
      settings = {
        companyName: s.companyName || DEFAULTS.companyName,
        logoUrl: s.logoUrl ?? null,
        contactEmail: s.contactEmail ?? "",
        contactPhone: s.contactPhone ?? "",
        contactAddress: s.contactAddress ?? "",
      };
      notify();
    })
    .catch(() => {});
}
function ensureLoaded() {
  if (!USE_API || loaded || typeof window === "undefined") return;
  loaded = true;
  void reload();
}
ensureLoaded();

const subscribe = (l: () => void) => {
  listeners.add(l);
  ensureLoaded();
  return () => listeners.delete(l);
};
const getSnapshot = () => settings;

export function useSiteSettings(): SiteSettings {
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
