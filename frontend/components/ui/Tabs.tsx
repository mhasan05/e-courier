"use client";

import { cn } from "@/lib/utils";

export interface TabItem {
  label: string;
  value: string;
  count?: number;
}

export interface TabsProps {
  tabs: TabItem[];
  value: string;
  onChange: (value: string) => void;
  className?: string;
}

// Segmented filter tabs (e.g. All / Pending / Active / Suspended).
export default function Tabs({ tabs, value, onChange, className }: TabsProps) {
  return (
    <div
      className={cn(
        "inline-flex flex-wrap gap-1 rounded-xl border border-brown-100 bg-brown-50 p-1",
        className,
      )}
    >
      {tabs.map((tab) => {
        const active = tab.value === value;
        return (
          <button
            key={tab.value}
            onClick={() => onChange(tab.value)}
            className={cn(
              "inline-flex items-center rounded-lg px-3 py-1.5 text-sm font-medium transition-all",
              active
                ? "bg-white text-brown-900 shadow-sm ring-1 ring-brown-100"
                : "text-brown-500 hover:text-brown-800",
            )}
          >
            {tab.label}
            {typeof tab.count === "number" && (
              <span
                className={cn(
                  "ml-1.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
                  active ? "bg-primary-50 text-primary-700" : "bg-brown-100 text-brown-500",
                )}
              >
                {tab.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
