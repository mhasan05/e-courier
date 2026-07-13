import Image from "next/image";
import { MapPin } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/lib/utils";
import { PARCEL_STATUS_META } from "@/lib/constants";
import type { ParcelStatusEvent } from "@/types";

export interface TimelineProps {
  events: ParcelStatusEvent[];
}

// Vertical stepper showing a parcel's status history (most recent first).
export default function Timeline({ events }: TimelineProps) {
  const ordered = [...events].sort((a, b) =>
    b.timestamp.localeCompare(a.timestamp),
  );

  return (
    <ol className="relative ml-2 border-l border-brown-100">
      {ordered.map((event, i) => {
        const meta = PARCEL_STATUS_META[event.status];
        const isLatest = i === 0;
        return (
          <li key={`${event.status}-${event.timestamp}`} className="mb-5 ml-5 last:mb-0">
            <span
              className={cn(
                "absolute -left-[7px] mt-1 flex h-3.5 w-3.5 items-center justify-center rounded-full ring-4 ring-white",
                isLatest ? "bg-primary" : "bg-brown-300",
              )}
            />
            <div className="flex flex-wrap items-center gap-2">
              <span
                className={cn(
                  "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
                  meta.classes,
                )}
              >
                {meta.label}
              </span>
              {event.hubName && (
                <span className="inline-flex items-center gap-1 text-xs font-medium text-brown-600">
                  <MapPin className="h-3 w-3 text-brown-400" /> {event.hubName}
                </span>
              )}
              <time className="text-xs text-brown-500">
                {formatDateTime(event.timestamp)}
              </time>
            </div>
            {event.remark && (
              <p className="mt-1 text-sm text-brown-500">{event.remark}</p>
            )}
            {event.proof && (event.proof.note || event.proof.photo) && (
              <div className="mt-1.5 rounded-lg border border-brown-100 bg-canvas p-2">
                <p className="mb-1 text-[11px] font-medium text-brown-500">
                  Proof of delivery
                </p>
                {event.proof.photo && (
                  <Image
                    src={event.proof.photo}
                    alt="Proof of delivery"
                    width={160}
                    height={120}
                    unoptimized
                    className="mb-1 h-28 w-auto rounded-md object-cover"
                  />
                )}
                {event.proof.note && (
                  <p className="text-sm text-brown-600">{event.proof.note}</p>
                )}
              </div>
            )}
            {event.changedBy && (
              <p className="text-xs text-brown-400">by {event.changedBy}</p>
            )}
          </li>
        );
      })}
    </ol>
  );
}
