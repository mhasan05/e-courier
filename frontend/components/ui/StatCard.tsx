import type { LucideIcon } from "lucide-react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: LucideIcon;
  trend?: number; // percentage; positive = up
  accent?: "primary" | "amber" | "brown";
}

const accents = {
  primary: "bg-primary-50 text-primary",
  amber: "bg-warning-50 text-warning-600",
  brown: "bg-brown-100 text-brown-600",
};

// Icon + label + value, with an optional trend arrow. Used on dashboards.
export default function StatCard({
  label,
  value,
  icon: Icon,
  trend,
  accent = "primary",
}: StatCardProps) {
  return (
    <div className="group rounded-xl border border-brown-100 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover">
      <div className="flex items-start justify-between">
        <p className="text-[11px] font-semibold uppercase tracking-[0.06em] text-brown-400">
          {label}
        </p>
        <span
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-xl transition-transform group-hover:scale-105",
            accents[accent],
          )}
        >
          <Icon className="h-[18px] w-[18px]" />
        </span>
      </div>
      <p className="mt-3 text-[28px] font-semibold leading-none tracking-tight text-brown-900">
        {value}
      </p>
      {typeof trend === "number" && (
        <div className="mt-3 flex items-center gap-2">
          <span
            className={cn(
              "inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-semibold",
              trend >= 0
                ? "bg-success-50 text-success-700"
                : "bg-danger-50 text-danger-600",
            )}
          >
            {trend >= 0 ? (
              <ArrowUpRight className="h-3.5 w-3.5" />
            ) : (
              <ArrowDownRight className="h-3.5 w-3.5" />
            )}
            {Math.abs(trend)}%
          </span>
          <span className="text-xs text-brown-400">vs last week</span>
        </div>
      )}
    </div>
  );
}
