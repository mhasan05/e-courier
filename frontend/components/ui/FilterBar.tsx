import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface FilterBarProps {
  children: ReactNode;
  className?: string;
}

// Composable filter row: drop in SearchInput / Select / date inputs as children.
export default function FilterBar({ children, className }: FilterBarProps) {
  return (
    <div
      className={cn(
        "flex flex-wrap items-end gap-3 rounded-xl border border-brown-100 bg-white p-4 shadow-card",
        className,
      )}
    >
      {children}
    </div>
  );
}

// Small labeled wrapper so heterogeneous filter controls line up nicely.
export function FilterField({
  label,
  children,
  className,
}: {
  label: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-brown-500">{label}</span>
      {children}
    </div>
  );
}
