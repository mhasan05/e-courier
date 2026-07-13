import { cn } from "@/lib/utils";
import { PARCEL_STATUS_META, MERCHANT_STATUS_META } from "@/lib/constants";
import type { ParcelStatus, MerchantStatus } from "@/types";

type Props =
  | { kind: "parcel"; status: ParcelStatus }
  | { kind: "merchant"; status: MerchantStatus };

// Maps a status string to a colored pill. Used across admin + merchant tables.
export default function StatusBadge(props: Props) {
  const meta =
    props.kind === "parcel"
      ? PARCEL_STATUS_META[props.status]
      : MERCHANT_STATUS_META[props.status];

  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium",
        meta.classes,
      )}
    >
      {meta.label}
    </span>
  );
}
