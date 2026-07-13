"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { DailyPoint } from "@/lib/analytics";

export interface ParcelTrendChartProps {
  data: DailyPoint[];
}

// Last-7-days parcel volume — gradient area chart.
export default function ParcelTrendChart({ data }: ParcelTrendChartProps) {
  const hasData = data.some((d) => d.count > 0);
  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-brown-400">
        No parcel data yet
      </div>
    );
  }
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
        <defs>
          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#38961c" stopOpacity={0.18} />
            <stop offset="100%" stopColor="#38961c" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={{ stroke: "#e2e8f0" }}
          tickLine={false}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12, fill: "#64748b" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 16px -2px rgb(15 23 42 / 0.10)",
          }}
          labelStyle={{ color: "#0f172a", fontWeight: 600 }}
        />
        <Area
          type="monotone"
          dataKey="count"
          name="Parcels"
          stroke="#38961c"
          strokeWidth={2.5}
          fill="url(#trendFill)"
          dot={{ r: 3, fill: "#38961c" }}
          activeDot={{ r: 5 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
