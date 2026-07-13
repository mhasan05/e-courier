"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search, PackageSearch } from "lucide-react";
import Button from "@/components/ui/Button";

// Customer entry point: look up a parcel by its tracking ID.
export default function TrackLookupPage() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (id) router.push(`/track/${encodeURIComponent(id)}`);
  };

  return (
    <div className="mx-auto max-w-md text-center">
      <span className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary-50 text-primary">
        <PackageSearch className="h-7 w-7" />
      </span>
      <h1 className="text-2xl font-semibold tracking-tight text-brown-900">Track your parcel</h1>
      <p className="mt-1 text-sm text-brown-500">
        Enter your tracking ID to see live delivery status.
      </p>

      <form onSubmit={onSubmit} className="mt-6 flex gap-2">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-500" />
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="e.g. CMS-2025-100002"
            className="h-11 w-full rounded-lg border border-brown-200 bg-white pl-9 pr-3 transition-colors hover:border-brown-300 text-sm text-brown-800 placeholder:text-brown-400 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
        </div>
        <Button type="submit" size="lg">
          Track
        </Button>
      </form>

      <p className="mt-4 text-xs text-brown-500">
        Tip: try <span className="font-mono text-brown-500">CMS-2025-100006</span> for a live demo.
      </p>
    </div>
  );
}
