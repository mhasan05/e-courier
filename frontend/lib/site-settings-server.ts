// Server-side (no "use client") fetch of site branding, used only for
// generateMetadata — the document <title> and favicon must reflect the real
// company name/logo without a client-side flash, so they're resolved before
// the HTML is ever sent rather than patched in after hydration.

interface ServerSiteSettings {
  companyName: string;
  logoUrl: string | null;
}

export async function fetchSiteSettingsServer(): Promise<ServerSiteSettings | null> {
  const base = process.env.NEXT_PUBLIC_API_URL;
  if (!base) return null;
  try {
    const res = await fetch(`${base}/site-settings/`, { next: { revalidate: 60 } });
    if (!res.ok) return null;
    const data = await res.json();
    return {
      companyName: typeof data.companyName === "string" ? data.companyName : "",
      logoUrl: data.logoUrl ?? null,
    };
  } catch {
    return null;
  }
}
