"use client";

import { useState } from "react";
import Link from "next/link";
import { Menu, X } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole } from "@/lib/auth";
import { useSiteSettings } from "@/lib/site-settings-store";
import BrandMark from "@/components/ui/BrandMark";

const LINKS = [
  { label: "Features", href: "#features" },
  { label: "How it works", href: "#how" },
  { label: "Coverage", href: "#coverage" },
  { label: "FAQ", href: "#faq" },
];

export default function LandingNav() {
  const [open, setOpen] = useState(false);
  const { session } = useAuth();
  const appName = useSiteSettings().companyName;

  return (
    <header className="sticky top-0 z-40 border-b border-brown-100 bg-canvas/80 backdrop-blur">
      <nav className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4">
        <Link href="/" className="flex items-center gap-2">
          <BrandMark className="h-9 w-9 rounded-xl shadow-sm" iconClass="h-5 w-5" />
          <span className="text-lg font-semibold tracking-tight text-brown-900">{appName}</span>
        </Link>

        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <a
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-brown-600 transition-colors hover:text-primary"
            >
              {l.label}
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          <Link
            href="/track"
            className="text-sm font-medium text-brown-600 hover:text-primary"
          >
            Track Parcel
          </Link>
          {session ? (
            <Link
              href={homeForRole(session.role)}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
            >
              Go to Dashboard
            </Link>
          ) : (
            <>
              <Link
                href="/login"
                className="text-sm font-medium text-brown-700 hover:text-primary"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-white hover:bg-primary-700"
              >
                Become a Merchant
              </Link>
            </>
          )}
        </div>

        <button
          className="rounded-md p-2 text-brown-600 md:hidden"
          onClick={() => setOpen((o) => !o)}
          aria-label="Toggle menu"
        >
          {open ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
        </button>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-brown-100 bg-canvas px-4 py-4 md:hidden">
          <div className="flex flex-col gap-3">
            {LINKS.map((l) => (
              <a
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="text-sm font-medium text-brown-600"
              >
                {l.label}
              </a>
            ))}
            <Link href="/track" onClick={() => setOpen(false)} className="text-sm font-medium text-brown-600">
              Track Parcel
            </Link>
            <div className="mt-2 flex gap-3">
              <Link
                href="/login"
                className="flex-1 rounded-lg border border-primary px-4 py-2 text-center text-sm font-semibold text-primary"
              >
                Login
              </Link>
              <Link
                href="/signup"
                className="flex-1 rounded-lg bg-primary px-4 py-2 text-center text-sm font-semibold text-white"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </div>
      )}
    </header>
  );
}
