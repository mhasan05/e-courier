import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps {
  children: ReactNode;
  className?: string;
}

// Generic pill badge. For status-specific colors use StatusBadge.
export default function Badge({ children, className }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        "bg-brown-100 text-brown-700",
        className,
      )}
    >
      {children}
    </span>
  );
}
