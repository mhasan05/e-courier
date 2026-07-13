import { cn } from "@/lib/utils";

export interface SkeletonProps {
  className?: string;
}

// Single shimmer block. Compose for cards/rows.
export default function Skeleton({ className }: SkeletonProps) {
  return (
    <div className={cn("animate-pulse rounded-md bg-brown-100/80", className)} />
  );
}

// Convenience: a few placeholder table rows.
export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div className="space-y-2 rounded-xl border border-brown-100 bg-white p-4 shadow-card">
      <Skeleton className="h-8 w-full" />
      {Array.from({ length: rows }).map((_, i) => (
        <Skeleton key={i} className="h-10 w-full" />
      ))}
    </div>
  );
}
