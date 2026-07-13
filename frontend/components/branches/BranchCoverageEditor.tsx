"use client";

import { useMemo, useState } from "react";
import { ChevronDown, Check } from "lucide-react";
import SearchInput from "@/components/ui/SearchInput";
import upazilas from "@/lib/mock-data/upazilas.json";
import { thanaKey } from "@/lib/hubs";
import { cn } from "@/lib/utils";

const DISTRICTS = Object.keys(upazilas as Record<string, string[]>).sort((a, b) =>
  a.localeCompare(b),
);

export interface BranchCoverageEditorProps {
  value: string[]; // qualified "District/Thana" keys
  onChange: (next: string[]) => void;
}

// Assign delivery coverage to a hub, grouped by district with per-thana control.
export default function BranchCoverageEditor({
  value,
  onChange,
}: BranchCoverageEditorProps) {
  const selected = useMemo(() => new Set(value), [value]);
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState<string | null>(null);

  const map = upazilas as Record<string, string[]>;
  const districts = DISTRICTS.filter((d) =>
    d.toLowerCase().includes(search.trim().toLowerCase()),
  );

  const commit = (next: Set<string>) => onChange(Array.from(next));

  const toggleThana = (district: string, thana: string) => {
    const next = new Set(selected);
    const key = thanaKey(district, thana);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    commit(next);
  };

  const toggleDistrict = (district: string) => {
    const next = new Set(selected);
    const thanas = map[district] ?? [];
    const allOn = thanas.every((t) => next.has(thanaKey(district, t)));
    for (const t of thanas) {
      const key = thanaKey(district, t);
      if (allOn) next.delete(key);
      else next.add(key);
    }
    commit(next);
  };

  return (
    <div className="rounded-lg border border-brown-200">
      <div className="border-b border-brown-100 p-2">
        <SearchInput value={search} onChange={setSearch} placeholder="Search district…" />
      </div>
      <div className="scrollbar-thin max-h-72 overflow-y-auto">
        {districts.map((district) => {
          const thanas = map[district] ?? [];
          const count = thanas.filter((t) =>
            selected.has(thanaKey(district, t)),
          ).length;
          const all = count === thanas.length;
          const some = count > 0 && !all;
          const expanded = open === district;
          return (
            <div key={district} className="border-b border-brown-50 last:border-0">
              <div className="flex items-center gap-2 px-3 py-2">
                <button
                  type="button"
                  onClick={() => toggleDistrict(district)}
                  className={cn(
                    "flex h-4 w-4 items-center justify-center rounded border",
                    all
                      ? "border-primary bg-primary text-white"
                      : some
                        ? "border-primary bg-primary-100 text-primary"
                        : "border-brown-300 bg-white",
                  )}
                  aria-label={`Toggle ${district}`}
                >
                  {all && <Check className="h-3 w-3" />}
                  {some && <span className="h-1.5 w-1.5 rounded-sm bg-primary" />}
                </button>
                <button
                  type="button"
                  onClick={() => setOpen(expanded ? null : district)}
                  className="flex flex-1 items-center justify-between text-left"
                >
                  <span className="text-sm font-medium text-brown-700">{district}</span>
                  <span className="flex items-center gap-2">
                    <span className="text-xs text-brown-500">
                      {count}/{thanas.length}
                    </span>
                    <ChevronDown
                      className={cn(
                        "h-4 w-4 text-brown-500 transition-transform",
                        expanded && "rotate-180",
                      )}
                    />
                  </span>
                </button>
              </div>
              {expanded && (
                <div className="grid grid-cols-2 gap-1 px-3 pb-2 pl-9 sm:grid-cols-3">
                  {thanas.map((t) => {
                    const on = selected.has(thanaKey(district, t));
                    return (
                      <label
                        key={t}
                        className="flex cursor-pointer items-center gap-1.5 text-xs text-brown-600"
                      >
                        <input
                          type="checkbox"
                          checked={on}
                          onChange={() => toggleThana(district, t)}
                          className="h-3.5 w-3.5 accent-primary"
                        />
                        {t}
                      </label>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
