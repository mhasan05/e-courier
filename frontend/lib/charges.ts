import { getZones } from "@/lib/zone-store";
import type { Zone, DeliveryType } from "@/types";

// Resolve the delivery zone for a recipient district. Falls back to the first
// active zone (Dhaka City) when the district isn't explicitly mapped. Returns
// undefined while zones are still loading from the API (empty store).
export function findZoneByDistrict(district: string): Zone | undefined {
  const allZones = getZones();
  const match = allZones.find(
    (z) => z.isActive && z.districts.includes(district),
  );
  return match ?? allZones.find((z) => z.isActive) ?? allZones[0];
}

export interface ChargeBreakdown {
  zoneName: string;
  deliveryCharge: number;
  codCharge: number;
  totalCharge: number;
}

// Mirrors the M6 backend compute_charge utility so the preview shown at booking
// time matches what the API will persist later.
//   delivery = base(zone, type) + weightExtra (10৳ per kg over 1kg)
//   cod      = max(10, codAmount * zone.codChargePercent / 100)
export function computeCharge(
  zone: Zone | undefined,
  deliveryType: DeliveryType,
  weight: number,
  codAmount: number,
): ChargeBreakdown {
  // Zones still loading (empty store) — return a zero breakdown so the preview
  // renders "৳0" instead of crashing; it fills in once zones arrive.
  if (!zone) {
    return { zoneName: "", deliveryCharge: 0, codCharge: 0, totalCharge: 0 };
  }
  const base =
    deliveryType === "express" ? zone.expressCharge : zone.regularCharge;
  const weightExtra = Math.max(0, Math.ceil(weight - 1)) * 10;
  const deliveryCharge = Math.round(base + weightExtra);
  const codCharge =
    codAmount > 0
      ? Math.max(10, Math.round((codAmount * zone.codChargePercent) / 100))
      : 0;
  return {
    zoneName: zone.name,
    deliveryCharge,
    codCharge,
    totalCharge: deliveryCharge + codCharge,
  };
}
