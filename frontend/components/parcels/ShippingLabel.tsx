import Barcode from "@/components/parcels/Barcode";
import { getMerchantById } from "@/lib/merchant-store";
import { getBranchById } from "@/lib/branch-store";
import { getSiteSettings } from "@/lib/site-settings-store";
import { formatBDT, formatDate } from "@/lib/utils";
import type { Parcel } from "@/types";

export interface ShippingLabelProps {
  parcel: Parcel;
}

// A4/thermal-friendly shipping label: sender, recipient, COD, and a scannable
// Code 128 barcode of the tracking ID. Pure black-on-white so it prints cleanly.
export default function ShippingLabel({ parcel }: ShippingLabelProps) {
  const appName = getSiteSettings().companyName;
  const sender = getMerchantById(parcel.merchantId);
  const origin = getBranchById(parcel.originBranchId);
  const dest = getBranchById(parcel.destinationBranchId);

  const toAddress = `${parcel.recipientAddress}${
    parcel.upazila ? ", " + parcel.upazila : ""
  }, ${parcel.district}`;

  return (
    <div className="mx-auto w-full max-w-[384px] border-2 border-black bg-white p-3 text-black">
      {/* Header */}
      <div className="flex items-center justify-between border-b-2 border-black pb-2">
        <span className="text-lg font-extrabold uppercase tracking-tight">{appName}</span>
        <span className="rounded border border-black px-2 py-0.5 text-[11px] font-bold uppercase">
          {parcel.deliveryType === "express" ? "Express" : "Regular"}
        </span>
      </div>

      {/* Barcode */}
      <div className="flex flex-col items-center border-b-2 border-black py-2">
        <Barcode value={parcel.trackingId} height={56} moduleWidth={1.5} />
      </div>

      {/* Route */}
      <div className="flex items-center justify-center gap-2 border-b-2 border-black py-1.5 text-sm font-bold">
        <span>{origin?.code ?? "—"}</span>
        <span>→</span>
        <span>{dest?.code ?? "—"}</span>
        {parcel.upazila && (
          <span className="ml-1 font-normal">({parcel.upazila})</span>
        )}
      </div>

      {/* To */}
      <div className="border-b-2 border-black py-2">
        <p className="text-[10px] font-bold uppercase text-black/60">Deliver To</p>
        <p className="text-base font-bold leading-tight">{parcel.recipientName}</p>
        <p className="text-sm font-semibold">{parcel.recipientPhone}</p>
        <p className="text-sm leading-snug">{toAddress}</p>
      </div>

      {/* COD */}
      <div className="flex items-stretch border-b-2 border-black">
        <div className="flex-1 border-r-2 border-black py-2">
          <p className="text-[10px] font-bold uppercase text-black/60">Cash to Collect</p>
          <p className="text-2xl font-extrabold">
            {parcel.codAmount > 0 ? formatBDT(parcel.codAmount) : "Non-COD"}
          </p>
        </div>
        <div className="flex w-28 flex-col justify-center py-2 pl-3">
          <p className="text-[10px] font-bold uppercase text-black/60">Weight</p>
          <p className="text-sm font-bold">{parcel.weight} kg</p>
        </div>
      </div>

      {/* From */}
      <div className="border-b-2 border-black py-2">
        <p className="text-[10px] font-bold uppercase text-black/60">From (Merchant)</p>
        <p className="text-sm font-semibold leading-tight">
          {sender?.shopName || sender?.name || parcel.merchantName}
        </p>
        {sender?.phone && <p className="text-xs">{sender.phone}</p>}
      </div>

      {/* Item + footer */}
      <div className="pt-2 text-xs">
        <p className="leading-snug">
          <span className="font-bold">Item: </span>
          {parcel.productDescription || "Parcel"}
          {parcel.invoiceNumber ? ` · Inv ${parcel.invoiceNumber}` : ""}
        </p>
        {parcel.specialInstructions && (
          <p className="mt-0.5 leading-snug">
            <span className="font-bold">Note: </span>
            {parcel.specialInstructions}
          </p>
        )}
        <div className="mt-1 flex items-center justify-between text-[10px] text-black/60">
          <span>Booked {formatDate(parcel.createdAt)}</span>
          <span>ID #{parcel.id}</span>
        </div>
      </div>
    </div>
  );
}
