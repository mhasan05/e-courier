"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  Calculator,
  ArrowRight,
  PackagePlus,
  ShieldCheck,
  Truck,
  Check,
} from "lucide-react";
import Select from "@/components/ui/Select";
import Input from "@/components/ui/Input";
import { useZones } from "@/lib/zone-store";
import { formatBDT, cn } from "@/lib/utils";

const NOTES = [
  "Minimum charge ৳80 applies for pick & drop service.",
  "1% Cash on Delivery & risk management charge applies.",
  "Delivery charge may vary based on parcel size.",
  "All charges are exclusive of VAT & tax.",
  "Delivery time may change due to unforeseen reasons.",
];

// Professional, self-contained delivery-charge calculator. Uses the same
// zone-based logic as the booking form so quotes match real bookings.
export default function PriceCalculator() {
  const zoneList = useZones();
  const activeZones = useMemo(() => zoneList.filter((z) => z.isActive), [zoneList]);
  const ZONE_OPTIONS = activeZones.map((z) => ({ value: z.name, label: z.name }));
  const firstZone = activeZones[0]?.name ?? "";

  const [from, setFrom] = useState("");
  const [destination, setDestination] = useState("");
  // Default the pickup/destination selects to the first zone once loaded.
  useEffect(() => {
    if (firstZone) {
      setFrom((v) => v || firstZone);
      setDestination((v) => v || firstZone);
    }
  }, [firstZone]);
  const [weight, setWeight] = useState("1");
  const [cod, setCod] = useState("");

  // Quote matches what an actual booking charges (Express home delivery).
  const quote = useMemo(() => {
    const zone = activeZones.find((z) => z.name === destination);
    if (!zone) return null;
    const w = Number(weight) || 0;
    const codAmount = Number(cod) || 0;
    const base = zone.expressCharge;
    const weightExtra = Math.max(0, Math.ceil(w - 1)) * 10;
    const codCharge =
      codAmount > 0
        ? Math.max(10, Math.round((codAmount * zone.codChargePercent) / 100))
        : 0;
    const deliveryCharge = Math.round(base + weightExtra);
    return {
      zone: zone.name,
      base: Math.round(base),
      weightExtra,
      codCharge,
      deliveryCharge,
      total: deliveryCharge + codCharge,
      estDays: "1–2 days",
    };
  }, [destination, weight, cod, activeZones]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4 rounded-2xl border border-brown-100 bg-white p-6 shadow-card">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-primary-50 text-primary">
          <Calculator className="h-7 w-7" />
        </span>
        <div>
          <h1 className="text-xl font-semibold tracking-tight text-brown-800">Delivery Price Calculator</h1>
          <p className="text-sm text-brown-500">
            Estimate your delivery charge instantly before you book.
          </p>
        </div>
      </div>

      {/* Calculator */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        {/* Inputs */}
        <div className="rounded-2xl border border-brown-100 bg-white p-6 shadow-card lg:col-span-3">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wide text-brown-500">
            Shipment Details
          </h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Select label="Pickup From" value={from} onChange={(e) => setFrom(e.target.value)} options={ZONE_OPTIONS} />
            <Select label="Deliver To" value={destination} onChange={(e) => setDestination(e.target.value)} options={ZONE_OPTIONS} />
            <Input label="Weight (KG)" type="number" step="0.1" value={weight} onChange={(e) => setWeight(e.target.value)} />
            <Input label="COD Amount (optional)" type="number" value={cod} onChange={(e) => setCod(e.target.value)} placeholder="0" />
          </div>

          {/* Breakdown */}
          {quote && (
            <div className="mt-6 rounded-xl bg-canvas p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-brown-500">
                Cost Breakdown
              </p>
              <dl className="space-y-1.5 text-sm">
                <Row label={`Base charge (${quote.zone})`} value={formatBDT(quote.base)} />
                {quote.weightExtra > 0 && (
                  <Row label="Weight surcharge" value={formatBDT(quote.weightExtra)} />
                )}
                {quote.codCharge > 0 && (
                  <Row label="COD charge (1%)" value={formatBDT(quote.codCharge)} />
                )}
                <div className="my-1.5 border-t border-brown-100" />
                <Row label="Total" value={formatBDT(quote.total)} emphasis />
              </dl>
            </div>
          )}
        </div>

        {/* Result */}
        <div className="lg:col-span-2">
          <div className="flex h-full flex-col justify-between rounded-2xl bg-gradient-to-br from-primary-700 to-primary p-6 text-white shadow-lg">
            <div>
              <p className="text-sm text-primary-100">Estimated Delivery Charge</p>
              <p className="mt-1 text-5xl font-bold">
                {quote ? formatBDT(quote.total) : "—"}
              </p>
              <div className="mt-5 space-y-2.5 text-sm text-primary-50">
                <p className="flex items-center gap-2">
                  <Truck className="h-4 w-4" /> {quote?.zone ?? "—"} zone
                </p>
                <p className="flex items-center gap-2">
                  <PackagePlus className="h-4 w-4" /> Est. delivery {quote?.estDays ?? "—"}
                </p>
                <p className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4" /> Insured &amp; trackable
                </p>
              </div>
            </div>
            <Link
              href="/merchant/parcels/new"
              className="mt-6 inline-flex items-center justify-center gap-2 rounded-lg bg-white px-4 py-2.5 text-sm font-semibold text-primary-700 hover:bg-primary-50"
            >
              Book a Parcel <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </div>

      {/* Standard zone rates */}
      <div className="overflow-hidden rounded-2xl border border-brown-100 bg-white shadow-card">
        <div className="border-b border-brown-100 px-6 py-4">
          <h2 className="text-sm font-semibold text-brown-700">Standard Zone Rates</h2>
          <p className="text-xs text-brown-500">Base charge for the first 1 kg. ৳10 per additional kg.</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-brown-100 bg-brown-50/60 text-xs font-semibold uppercase tracking-wide text-brown-500">
                <th className="px-6 py-3">Zone</th>
                <th className="px-6 py-3">Express</th>
                <th className="px-6 py-3">COD %</th>
                <th className="px-6 py-3">Return</th>
              </tr>
            </thead>
            <tbody>
              {activeZones.map((z) => (
                <tr key={z.id} className="border-b border-brown-50 last:border-0 hover:bg-canvas/60">
                  <td className="px-6 py-3 font-medium text-brown-800">{z.name}</td>
                  <td className="px-6 py-3 text-brown-700">{formatBDT(z.expressCharge)}</td>
                  <td className="px-6 py-3 text-brown-700">{z.codChargePercent}%</td>
                  <td className="px-6 py-3 text-brown-700">{formatBDT(z.returnCharge)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Terms */}
      <div className="rounded-2xl border border-brown-100 bg-white p-6 shadow-card">
        <h2 className="mb-4 text-sm font-semibold text-brown-700">Pricing Terms</h2>
        <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
          {NOTES.map((note) => (
            <li key={note} className="flex items-start gap-2 text-sm text-brown-500">
              <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded bg-primary text-white">
                <Check className="h-3 w-3" />
              </span>
              {note}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Row({
  label,
  value,
  emphasis,
}: {
  label: string;
  value: string;
  emphasis?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <dt className={cn(emphasis ? "font-semibold text-brown-800" : "text-brown-500")}>
        {label}
      </dt>
      <dd className={cn(emphasis ? "text-base font-bold text-primary" : "text-brown-700")}>
        {value}
      </dd>
    </div>
  );
}
