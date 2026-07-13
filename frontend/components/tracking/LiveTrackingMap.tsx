"use client";

import { useEffect, useState } from "react";
import { Bike, MapPin, Store } from "lucide-react";
import { PARCEL_STATUS_META } from "@/lib/constants";
import type { ParcelStatus } from "@/types";

export interface LiveTrackingMapProps {
  status: ParcelStatus;
  originLabel: string;
  destLabel: string;
}

// Base progress (0..1) along the route for each status.
const PROGRESS: Record<ParcelStatus, number> = {
  pending: 0.04,
  picked_up: 0.2,
  in_transit: 0.5,
  at_hub: 0.62,
  out_for_delivery: 0.82,
  delivered: 1,
  partially_delivered: 0.9,
  return_in_transit: 0.4,
  returned: 0.04,
  cancelled: 0,
};

// Statuses where the courier is actively moving — drives the "live" animation.
const LIVE_STATUSES: ParcelStatus[] = [
  "picked_up",
  "in_transit",
  "out_for_delivery",
  "return_in_transit",
];

// Quadratic Bézier point at parameter t between origin, arc control, and dest.
function bezier(t: number) {
  const p0 = { x: 44, y: 150 };
  const p1 = { x: 200, y: 34 };
  const p2 = { x: 356, y: 150 };
  const mt = 1 - t;
  return {
    x: mt * mt * p0.x + 2 * mt * t * p1.x + t * t * p2.x,
    y: mt * mt * p0.y + 2 * mt * t * p1.y + t * t * p2.y,
  };
}

export default function LiveTrackingMap({
  status,
  originLabel,
  destLabel,
}: LiveTrackingMapProps) {
  const isLive = LIVE_STATUSES.includes(status);
  const [tick, setTick] = useState(0);
  const [updatedAt, setUpdatedAt] = useState<string>("");

  useEffect(() => {
    setUpdatedAt(new Date().toLocaleTimeString());
    if (!isLive) return;
    const interval = setInterval(() => {
      setTick((t) => t + 1);
      setUpdatedAt(new Date().toLocaleTimeString());
    }, 2500);
    return () => clearInterval(interval);
  }, [isLive]);

  // Live jitter: gently oscillate around the base progress to feel in-motion.
  const base = PROGRESS[status];
  const t = isLive
    ? Math.min(0.97, Math.max(0.03, base + Math.sin(tick / 1.5) * 0.05))
    : base;
  const pos = bezier(t);
  const meta = PARCEL_STATUS_META[status];

  return (
    <div className="overflow-hidden rounded-xl border border-brown-100 bg-white shadow-card">
      <div className="flex items-center justify-between border-b border-brown-100 px-5 py-3">
        <h2 className="text-sm font-semibold text-brown-700">Live Location</h2>
        {isLive ? (
          <span className="inline-flex items-center gap-1.5 text-xs font-medium text-primary">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
            </span>
            LIVE
          </span>
        ) : (
          <span className="text-xs text-brown-500">Tracking</span>
        )}
      </div>

      {/* Faux map */}
      <div className="relative bg-[#f0f9e8]">
        <svg viewBox="0 0 400 200" className="h-56 w-full">
          {/* grid */}
          <defs>
            <pattern id="grid" width="28" height="28" patternUnits="userSpaceOnUse">
              <path d="M 28 0 L 0 0 0 28" fill="none" stroke="#e2e8f0" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="400" height="200" fill="url(#grid)" />

          {/* route */}
          <path
            d="M 44 150 Q 200 34 356 150"
            fill="none"
            stroke="#bfdbfe"
            strokeWidth="4"
            strokeLinecap="round"
          />
          <path
            d={`M 44 150 Q 200 34 ${pos.x} ${pos.y}`}
            fill="none"
            stroke="#38961c"
            strokeWidth="4"
            strokeLinecap="round"
          />

          {/* origin + destination pins */}
          <circle cx="44" cy="150" r="7" fill="#0f172a" />
          <circle cx="356" cy="150" r="7" fill="#7C3AED" />

          {/* moving courier marker */}
          <g transform={`translate(${pos.x}, ${pos.y})`}>
            <circle r="13" fill="#38961c" />
            <circle r="13" fill="#38961c" opacity="0.25" className={isLive ? "animate-ping" : ""} />
          </g>
        </svg>

        {/* courier icon overlaid (lucide can't sit inside SVG easily) */}
        <Bike
          className="pointer-events-none absolute h-4 w-4 text-white"
          style={{
            left: `${(pos.x / 400) * 100}%`,
            top: `${(pos.y / 200) * 100}%`,
            transform: "translate(-50%, -50%)",
          }}
        />
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
        <span className="inline-flex items-center gap-1.5 text-brown-600">
          <Store className="h-4 w-4 text-brown-500" /> {originLabel}
        </span>
        <span className="rounded-full px-2 py-0.5 text-xs font-medium" style={{ background: "#f0f9e8" }}>
          {meta.label}
        </span>
        <span className="inline-flex items-center gap-1.5 text-brown-600">
          <MapPin className="h-4 w-4 text-amber" /> {destLabel}
        </span>
      </div>

      {updatedAt && (
        <p className="border-t border-brown-100 px-5 py-2 text-xs text-brown-500">
          {isLive ? "Last updated" : "As of"} {updatedAt}
        </p>
      )}
    </div>
  );
}
