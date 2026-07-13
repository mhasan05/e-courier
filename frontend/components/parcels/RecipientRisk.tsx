"use client";

import { ShieldCheck, ShieldAlert, ShieldQuestion } from "lucide-react";
import { useParcels } from "@/lib/parcel-store";
import { recipientStats, TIER_META } from "@/lib/recipient-stats";
import { cn } from "@/lib/utils";

export interface RecipientRiskProps {
  phone: string;
  excludeParcelId?: number; // don't count the parcel currently being viewed/booked
  className?: string;
}

// Compact recipient delivery-history panel. Renders nothing until the phone is
// long enough to match. Used on the booking form and parcel detail views.
export default function RecipientRisk({
  phone,
  excludeParcelId,
  className,
}: RecipientRiskProps) {
  const parcels = useParcels();
  const stats = recipientStats(parcels, phone, excludeParcelId);

  if (!stats) return null;

  const meta = TIER_META[stats.tier];
  const Icon =
    stats.tier === "good"
      ? ShieldCheck
      : stats.tier === "risky"
        ? ShieldAlert
        : ShieldQuestion;

  return (
    <div
      className={cn(
        "flex flex-wrap items-center gap-x-3 gap-y-1 rounded-lg border border-brown-100 bg-canvas px-3 py-2 text-sm",
        className,
      )}
    >
      <span className="flex items-center gap-1.5 font-medium text-brown-700">
        <Icon
          className={cn(
            "h-4 w-4",
            stats.tier === "good"
              ? "text-primary"
              : stats.tier === "risky"
                ? "text-red-500"
                : stats.tier === "ok"
                  ? "text-warning-500"
                  : "text-brown-500",
          )}
        />
        Recipient history
      </span>

      <span
        className={cn(
          "rounded-full px-2 py-0.5 text-xs font-medium",
          meta.classes,
        )}
      >
        {meta.label}
      </span>

      {stats.successRate == null ? (
        <span className="text-xs text-brown-500">
          No completed deliveries to this number yet.
        </span>
      ) : (
        <span className="text-xs text-brown-500">
          <span className="font-semibold text-brown-700">
            {Math.round(stats.successRate * 100)}%
          </span>{" "}
          success ·{" "}
          <span className="text-primary-700">{stats.delivered} delivered</span>,{" "}
          <span className="text-red-600">{stats.returned} returned</span>
          {stats.inProgress > 0 && (
            <span className="text-brown-500"> · {stats.inProgress} ongoing</span>
          )}
        </span>
      )}
    </div>
  );
}
