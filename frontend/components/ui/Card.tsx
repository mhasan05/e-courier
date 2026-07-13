import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface CardProps {
  title?: ReactNode;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
  bodyClassName?: string;
}

// Standard white surface with optional header (title + right-side action).
export default function Card({
  title,
  action,
  children,
  className,
  bodyClassName,
}: CardProps) {
  return (
    <section
      className={cn(
        "rounded-xl border border-brown-100 bg-white shadow-card",
        className,
      )}
    >
      {(title || action) && (
        <header className="flex items-center justify-between gap-2 border-b border-brown-100 px-5 py-4">
          {title && (
            <h2 className="text-[15px] font-semibold tracking-tight text-brown-900">
              {title}
            </h2>
          )}
          {action}
        </header>
      )}
      <div className={cn("p-5", bodyClassName)}>{children}</div>
    </section>
  );
}
