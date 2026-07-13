import { apiGet, apiPatch, api } from "@/lib/api";

export interface SiteSettingsDTO {
  companyName: string;
  logoUrl: string | null;
  contactEmail: string;
  contactPhone: string;
  contactAddress: string;
}

export const getSiteSettings = () => apiGet<SiteSettingsDTO>("/site-settings/");

export const updateSiteSettings = (patch: Record<string, unknown>) =>
  apiPatch<SiteSettingsDTO>("/site-settings/", patch);

// Logo upload uses multipart (PATCH with a FormData body).
export const updateSiteSettingsLogo = (form: FormData) =>
  api<SiteSettingsDTO>("/site-settings/", { method: "PATCH", body: form });
