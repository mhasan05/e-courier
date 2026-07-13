import type { ReactNode } from "react";
import { formatBDT } from "@/lib/utils";
import type { OpBreakdown } from "@/lib/analytics";

// Big headline number with a caption. Optional accent colour + hint line.
export function StatTile({
  label,
  value,
  hint,
  tone = "default",
}: {
  label: string;
  value: string | number;
  hint?: string;
  tone?: "default" | "primary" | "success" | "danger" | "warning";
}) {
  const valueTone =
    tone === "primary"
      ? "text-primary"
      : tone === "success"
        ? "text-success-600"
        : tone === "danger"
          ? "text-danger-600"
          : tone === "warning"
            ? "text-warning-600"
            : "text-brown-800";
  return (
    <div className="rounded-xl border border-brown-100 bg-white p-4 shadow-card">
      <p className="text-sm text-brown-500">{label}</p>
      <p className={`mt-1 text-2xl font-semibold tracking-tight ${valueTone}`}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-xs text-brown-400">{hint}</p>}
    </div>
  );
}

// The operational pipeline as a single horizontal strip: where parcels sit now.
const PIPELINE: { key: keyof OpBreakdown; label: string; dot: string }[] = [
  { key: "pending", label: "Awaiting pickup", dot: "bg-warning-500" },
  { key: "inTransit", label: "In transit", dot: "bg-blue-500" },
  { key: "atHub", label: "At hub", dot: "bg-indigo-500" },
  { key: "outForDelivery", label: "Out for delivery", dot: "bg-amber-500" },
  { key: "delivered", label: "Delivered", dot: "bg-success-500" },
  { key: "returned", label: "Returned", dot: "bg-danger-500" },
];

export function PipelineStrip({ b }: { b: OpBreakdown }) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-6">
      {PIPELINE.map((s) => (
        <div
          key={s.key}
          className="rounded-lg border border-brown-100 bg-white p-3 text-center shadow-card"
        >
          <span
            className={`mx-auto mb-1 block h-2 w-2 rounded-full ${s.dot}`}
          />
          <p className="text-xl font-semibold text-brown-800">{b[s.key]}</p>
          <p className="text-[11px] leading-tight text-brown-500">{s.label}</p>
        </div>
      ))}
    </div>
  );
}

// COD money split — collected (green) vs still-to-collect (amber).
export function CodSplit({
  collected,
  pending,
}: {
  collected: number;
  pending: number;
}) {
  const total = collected + pending || 1;
  const pct = Math.round((collected / total) * 100);
  return (
    <div className="rounded-xl border border-brown-100 bg-white p-4 shadow-card">
      <div className="flex items-end justify-between gap-4">
        <div>
          <p className="text-sm text-brown-500">COD collected</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-success-600">
            {formatBDT(collected)}
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-brown-500">Still to collect</p>
          <p className="mt-1 text-2xl font-semibold tracking-tight text-warning-600">
            {formatBDT(pending)}
          </p>
        </div>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-warning-100">
        <div
          className="h-full rounded-full bg-success-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="mt-1.5 text-xs text-brown-400">
        {pct}% of expected COD already collected.
      </p>
    </div>
  );
}

// Horizontal proportion bars for an arbitrary breakdown (status, rider, etc.).
export interface BreakdownRow {
  label: ReactNode;
  count: number;
  color?: string;
}

export function BreakdownBars({ rows }: { rows: BreakdownRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (rows.length === 0)
    return <p className="text-sm text-brown-400">No data.</p>;
  return (
    <div className="space-y-2.5">
      {rows.map((r, i) => (
        <div key={i}>
          <div className="mb-1 flex items-center justify-between text-xs">
            <span className="text-brown-700">{r.label}</span>
            <span className="font-medium text-brown-500">{r.count}</span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-brown-100">
            <div
              className="h-full rounded-full"
              style={{
                width: `${Math.round((r.count / max) * 100)}%`,
                backgroundColor: r.color ?? "#059669",
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
