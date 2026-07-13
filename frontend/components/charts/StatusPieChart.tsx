"use client";

import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import type { StatusSlice } from "@/lib/analytics";

export interface StatusPieChartProps {
  data: StatusSlice[];
}

// Delivered vs Returned vs Pending donut chart.
export default function StatusPieChart({ data }: StatusPieChartProps) {
  const hasData = data.some((d) => d.value > 0);

  if (!hasData) {
    return (
      <div className="flex h-[260px] items-center justify-center text-sm text-brown-400">
        No parcel data
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={55}
          outerRadius={90}
          paddingAngle={2}
        >
          {data.map((slice) => (
            <Cell key={slice.name} fill={slice.color} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            borderRadius: 12,
            border: "1px solid #e2e8f0",
            fontSize: 12,
            boxShadow: "0 4px 16px -2px rgb(15 23 42 / 0.10)",
          }}
        />
        <Legend
          iconType="circle"
          wrapperStyle={{ fontSize: 12, color: "#64748b" }}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
