"use client";

import { useRef, useState, type DragEvent } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud, FileText, X, Download } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Select from "@/components/ui/Select";
import { useToast } from "@/components/ui/Toast";
import { parseCsv } from "@/lib/csv";
import { findZoneByDistrict, computeCharge } from "@/lib/charges";
import { resolveOriginHub, resolveDestinationHub } from "@/lib/hubs";
import {
  addParcel,
  bookParcel,
  generateTrackingId,
  nextParcelId,
} from "@/lib/parcel-store";
import { apiEnabled } from "@/lib/api";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { cn } from "@/lib/utils";
import type { Parcel } from "@/types";

// System fields the importer maps CSV columns onto.
const FIELDS: { key: string; label: string; required: boolean }[] = [
  { key: "recipient_name", label: "Recipient Name", required: true },
  { key: "recipient_phone", label: "Recipient Phone", required: true },
  { key: "recipient_address", label: "Recipient Address", required: true },
  { key: "recipient_district", label: "District", required: true },
  { key: "recipient_thana", label: "Thana", required: true },
  { key: "weight", label: "Weight (kg)", required: false },
  { key: "cod_amount", label: "COD Amount", required: false },
];

function autoMatch(field: string, headers: string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z]/g, "");
  return headers.find((h) => norm(h) === norm(field)) ?? "";
}

export default function ImportParcelsPage() {
  const toast = useToast();
  const router = useRouter();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const fileRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);
  const [fileName, setFileName] = useState("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [rows, setRows] = useState<string[][]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});

  const handleFile = (file?: File) => {
    if (!file) return;
    if (!/\.csv$/i.test(file.name)) {
      toast.error("Please upload a .csv file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const { headers: hs, rows: rs } = parseCsv(String(reader.result));
      if (hs.length === 0) {
        toast.error("Could not read any columns from that file");
        return;
      }
      setFileName(file.name);
      setHeaders(hs);
      setRows(rs);
      const initial: Record<string, string> = {};
      for (const f of FIELDS) initial[f.key] = autoMatch(f.key, hs);
      setMapping(initial);
    };
    reader.readAsText(file);
  };

  const onDrop = (e: DragEvent) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  };

  const reset = () => {
    setFileName("");
    setHeaders([]);
    setRows([]);
    setMapping({});
  };

  const colIndex = (field: string) => headers.indexOf(mapping[field]);
  const cell = (row: string[], field: string) => {
    const idx = colIndex(field);
    return idx >= 0 ? (row[idx] ?? "").trim() : "";
  };

  // Generate a ready-to-fill template with the expected headers + example rows.
  const downloadSample = () => {
    const header = FIELDS.map((f) => f.key).join(",");
    // Columns: recipient_name, recipient_phone, recipient_address,
    // recipient_district, recipient_thana, weight, cod_amount
    const examples = [
      ["Rahim Uddin", "01711111111", "House 5, Road 2, Dhanmondi", "Dhaka", "Dhanmondi", "0.5", "1200"],
      ["Karima Begum", "01822222222", "Station Road, Kotwali", "Chattogram", "Kotwali", "1.2", "2500"],
      ["Jamal Hossain", "01933333333", "College Para", "Bogura", "Bogura Sadar", "2", "0"],
    ];
    const esc = (v: string) =>
      /[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v;
    const csv = [header, ...examples.map((r) => r.map(esc).join(","))].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "parcel-import-sample.csv";
    link.click();
    URL.revokeObjectURL(url);
  };

  const runImport = async () => {
    const missing = FIELDS.filter((f) => f.required && !mapping[f.key]);
    if (missing.length > 0) {
      toast.error(`Map required columns: ${missing.map((m) => m.label).join(", ")}`);
      return;
    }

    const requiredKeys = FIELDS.filter((f) => f.required).map((f) => f.key);

    let created = 0;
    let skipped = 0;
    let nextId = nextParcelId();
    for (const row of rows) {
      // Every mandatory field must have a value, otherwise skip the row.
      if (!requiredKeys.every((k) => cell(row, k))) {
        skipped++;
        continue;
      }
      const district = cell(row, "recipient_district");
      const thana = cell(row, "recipient_thana");
      const weight = Number(cell(row, "weight")) || 0.5;
      const codAmount = Number(cell(row, "cod_amount")) || 0;

      // API path — the server computes charges, routing and OTP per parcel.
      if (apiEnabled()) {
        try {
          await bookParcel({
            recipientName: cell(row, "recipient_name"),
            recipientPhone: cell(row, "recipient_phone"),
            recipientAddress: cell(row, "recipient_address"),
            district,
            upazila: thana,
            weight,
            codAmount,
          });
          created++;
        } catch {
          skipped++;
        }
        continue;
      }

      const zone = findZoneByDistrict(district);
      // Express-only for now (standard delivery to be added later).
      const charge = computeCharge(zone, "express", weight, codAmount);
      const originHub = resolveOriginHub(me);
      const destinationHub = resolveDestinationHub(district, thana);
      if (!originHub || !destinationHub) {
        skipped++;
        continue;
      }
      const now = new Date().toISOString();

      const parcel: Parcel = {
        id: nextId++,
        trackingId: generateTrackingId(),
        merchantId: me.id,
        merchantName: me.shopName,
        recipientName: cell(row, "recipient_name"),
        recipientPhone: cell(row, "recipient_phone"),
        recipientAddress: cell(row, "recipient_address"),
        district,
        upazila: thana,
        zone: charge.zoneName,
        originBranchId: originHub.id,
        destinationBranchId: destinationHub.id,
        currentBranchId: originHub.id,
        ownerBranchId: me.homeBranchId ?? originHub.id,
        deliveryType: "express",
        deliveryMethod: "home",
        weight,
        productDescription: "",
        codAmount,
        deliveryCharge: charge.deliveryCharge,
        codCharge: charge.codCharge,
        totalCharge: charge.totalCharge,
        status: "pending",
        createdAt: now.slice(0, 10),
        history: [{ status: "pending", changedBy: "Merchant", timestamp: now }],
      };
      addParcel(parcel);
      created++;
    }

    if (created === 0) {
      toast.error("No valid rows — every row needs all required fields filled.");
      return;
    }
    toast.success(
      `Imported ${created} parcel(s)` +
        (skipped > 0 ? ` · skipped ${skipped} incomplete row(s)` : ""),
    );
    router.push("/merchant/parcels");
  };

  return (
    <div className="mx-auto max-w-3xl space-y-4">
      {headers.length === 0 ? (
        <Card>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={onDrop}
            onClick={() => fileRef.current?.click()}
            className={cn(
              "flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed py-14 text-center transition-colors",
              dragging
                ? "border-primary bg-primary-50"
                : "border-brown-200 hover:border-primary hover:bg-canvas",
            )}
          >
            <UploadCloud className="h-10 w-10 text-brown-400" />
            <p className="mt-3 text-sm font-medium text-brown-700">
              Drag & drop a CSV file here
            </p>
            <p className="text-xs text-brown-500">or click to browse (.csv)</p>
            <input
              ref={fileRef}
              type="file"
              accept=".csv"
              className="hidden"
              onChange={(e) => handleFile(e.target.files?.[0])}
            />
          </div>
          <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
            <p className="text-xs text-brown-500">
              Expected columns: recipient_name, recipient_phone, recipient_address,
              recipient_district, recipient_thana, weight, cod_amount. (name, phone,
              address, district &amp; thana are required)
            </p>
            <Button variant="outline" size="sm" onClick={downloadSample}>
              <Download className="h-4 w-4" /> Download Sample CSV
            </Button>
          </div>
          <p className="mt-2 text-xs text-brown-500">
            Tip: download the sample, fill in your parcels using the same columns,
            then upload it here.
          </p>
        </Card>
      ) : (
        <>
          <div className="flex items-center justify-between rounded-lg border border-brown-100 bg-white px-4 py-3">
            <div className="flex items-center gap-2 text-sm text-brown-700">
              <FileText className="h-4 w-4 text-primary" />
              <span className="font-medium">{fileName}</span>
              <span className="text-brown-500">· {rows.length} rows</span>
            </div>
            <button
              onClick={reset}
              className="rounded-md p-1 text-brown-500 hover:bg-brown-100"
              aria-label="Remove file"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Column mapping */}
          <Card title="Map Columns">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {FIELDS.map((f) => (
                <div key={f.key} className="flex flex-col gap-1">
                  <span className="text-xs font-medium text-brown-500">
                    {f.label}
                    {f.required && <span className="text-red-500"> *</span>}
                  </span>
                  <Select
                    value={mapping[f.key] ?? ""}
                    onChange={(e) =>
                      setMapping((m) => ({ ...m, [f.key]: e.target.value }))
                    }
                    placeholder="— not mapped —"
                    options={headers.map((h) => ({ value: h, label: h }))}
                  />
                </div>
              ))}
            </div>
          </Card>

          {/* Preview first 5 rows */}
          <Card title="Preview (first 5 rows)" bodyClassName="p-0">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brown-100 bg-brown-50/60 text-xs font-semibold uppercase tracking-wide text-brown-500">
                    {FIELDS.map((f) => (
                      <th key={f.key} className="px-3 py-2 whitespace-nowrap">
                        {f.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.slice(0, 5).map((row, i) => (
                    <tr key={i} className="border-b border-brown-50 last:border-0">
                      {FIELDS.map((f) => (
                        <td key={f.key} className="px-3 py-2 text-brown-700">
                          {cell(row, f.key) || (
                            <span className="text-brown-400">—</span>
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>

          <div className="flex justify-end gap-2">
            <Button variant="ghost" onClick={reset}>
              Cancel
            </Button>
            <Button onClick={runImport}>Import {rows.length} Parcels</Button>
          </div>
        </>
      )}
    </div>
  );
}
