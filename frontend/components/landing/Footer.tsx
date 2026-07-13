"use client";

import Link from "next/link";
import { Mail, Phone, MapPin } from "lucide-react";
import { useSiteSettings } from "@/lib/site-settings-store";
import BrandMark from "@/components/ui/BrandMark";

const SOCIALS = ["f", "X", "in"];

export default function Footer() {
  const { companyName: appName, contactEmail, contactPhone, contactAddress } = useSiteSettings();
  return (
    <footer className="bg-brown-800 text-brown-100">
      <div className="mx-auto grid max-w-6xl grid-cols-1 gap-10 px-4 py-14 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <BrandMark className="h-9 w-9 rounded-lg" iconClass="h-5 w-5" />
            <span className="text-lg font-semibold tracking-tight text-white">{appName}</span>
          </Link>
          <p className="mt-3 text-sm text-brown-200">
            Fast courier &amp; parcel delivery for online businesses across
            Dhaka.
          </p>
          <div className="mt-4 flex gap-3">
            {SOCIALS.map((s) => (
              <span
                key={s}
                className="flex h-9 w-9 items-center justify-center rounded-lg bg-brown-700 text-sm font-semibold text-brown-100 hover:bg-primary hover:text-white"
              >
                {s}
              </span>
            ))}
          </div>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Company</h4>
          <ul className="space-y-2 text-sm text-brown-200">
            <li><a href="#features" className="hover:text-white">Features</a></li>
            <li><a href="#how" className="hover:text-white">How it works</a></li>
            <li><a href="#coverage" className="hover:text-white">Coverage</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">For Merchants</h4>
          <ul className="space-y-2 text-sm text-brown-200">
            <li><Link href="/signup" className="hover:text-white">Become a Merchant</Link></li>
            <li><Link href="/login" className="hover:text-white">Merchant Login</Link></li>
            <li><Link href="/track" className="hover:text-white">Track a Parcel</Link></li>
            <li><a href="#faq" className="hover:text-white">FAQ</a></li>
          </ul>
        </div>

        <div>
          <h4 className="mb-3 text-sm font-semibold text-white">Contact</h4>
          <ul className="space-y-2 text-sm text-brown-200">
            <li className="flex items-center gap-2">
              <MapPin className="h-4 w-4" /> {contactAddress || "Dhaka, Bangladesh"}
            </li>
            {contactPhone && (
              <li className="flex items-center gap-2">
                <Phone className="h-4 w-4" />
                <a href={`tel:${contactPhone}`} className="hover:text-white">{contactPhone}</a>
              </li>
            )}
            {contactEmail && (
              <li className="flex items-center gap-2">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${contactEmail}`} className="hover:text-white">{contactEmail}</a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-t border-brown-700">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-2 px-4 py-5 text-xs text-brown-400 sm:flex-row">
          <p>© {new Date().getFullYear()} {appName}. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="#" className="hover:text-white">Privacy Policy</a>
            <a href="#" className="hover:text-white">Terms of Service</a>
          </div>
        </div>
      </div>
    </footer>
  );
}
