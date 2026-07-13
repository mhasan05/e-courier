"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface DropdownItem {
  label: string;
  onClick: () => void;
  danger?: boolean;
}

export interface DropdownProps {
  /** Trigger content. Defaults to a labeled button with a chevron. */
  trigger?: ReactNode;
  label?: string;
  items: DropdownItem[];
  align?: "left" | "right";
}

// Click-to-open menu used for row actions and the topbar user menu.
export default function Dropdown({
  trigger,
  label = "Actions",
  items,
  align = "right",
}: DropdownProps) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  return (
    <div className="relative inline-block" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5"
      >
        {trigger ?? (
          <span className="inline-flex items-center gap-1 rounded-lg border border-brown-200 bg-white px-3 py-1.5 text-sm text-brown-700 hover:bg-brown-50">
            {label}
            <ChevronDown className="h-4 w-4" />
          </span>
        )}
      </button>
      {open && (
        <div
          className={cn(
            "absolute z-20 mt-1 min-w-[10rem] overflow-hidden rounded-lg border border-brown-100 bg-white py-1 shadow-lg",
            align === "right" ? "right-0" : "left-0",
          )}
        >
          {items.map((item, i) => (
            <button
              key={i}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className={cn(
                "block w-full px-4 py-2 text-left text-sm hover:bg-brown-50",
                item.danger ? "text-red-600" : "text-brown-700",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
