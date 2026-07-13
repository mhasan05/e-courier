"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { Search } from "lucide-react";

// Hero tracking lookup — sends the customer to the public tracker.
export default function TrackInput() {
  const router = useRouter();
  const [value, setValue] = useState("");

  const onSubmit = (e: FormEvent) => {
    e.preventDefault();
    const id = value.trim();
    if (id) router.push(`/track/${encodeURIComponent(id)}`);
  };

  return (
    <form
      onSubmit={onSubmit}
      className="flex w-full max-w-md items-center gap-2 rounded-xl bg-white p-2 shadow-lg"
    >
      <div className="relative flex-1">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-brown-500" />
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Enter tracking ID e.g. CMS-2025-100006"
          className="h-11 w-full rounded-lg bg-transparent pl-9 pr-3 text-sm text-brown-800 placeholder:text-brown-400 focus:outline-none"
        />
      </div>
      <button
        type="submit"
        className="h-11 shrink-0 rounded-lg bg-primary px-5 text-sm font-semibold text-white hover:bg-primary-700"
      >
        Track
      </button>
    </form>
  );
}
