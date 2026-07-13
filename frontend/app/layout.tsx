import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { ToastProvider } from "@/components/ui/Toast";
import { fetchSiteSettingsServer } from "@/lib/site-settings-server";

const fontSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-sans",
  weight: "100 900",
});
const fontMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-mono",
  weight: "100 900",
});

// Used only when no backend is configured (local demo/dev without an API) —
// the real title/favicon are resolved server-side below whenever one is.
const FALLBACK_NAME = process.env.NEXT_PUBLIC_APP_NAME || "Courier CMS";

export async function generateMetadata(): Promise<Metadata> {
  const settings = await fetchSiteSettingsServer();
  const companyName = settings?.companyName || FALLBACK_NAME;
  return {
    title: companyName,
    description: `${companyName} — Courier Management System`,
    // Always set explicitly (never left to Next's app/favicon.ico file
    // convention) so there's exactly one <link rel="icon">, not a real logo
    // competing with a leftover default in the page head.
    icons: { icon: settings?.logoUrl || "/favicon.ico" },
  };
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${fontSans.variable} ${fontMono.variable} font-sans`}>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
