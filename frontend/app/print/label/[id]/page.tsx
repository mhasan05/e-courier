"use client";

import { Suspense, useMemo } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Printer, ArrowLeft } from "lucide-react";
import Button from "@/components/ui/Button";
import PanelLoading from "@/components/layout/PanelLoading";
import ShippingLabel from "@/components/parcels/ShippingLabel";
import { useParcels } from "@/lib/parcel-store";
import { useHydrated } from "@/hooks/useHydrated";

export default function PrintLabelPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<PanelLoading />}>
      <PrintLabelContent id={params.id} />
    </Suspense>
  );
}

function PrintLabelContent({ id }: { id: string }) {
  const hydrated = useHydrated();
  const search = useSearchParams();
  const all = useParcels();

  // Single label by path id, or a batch via ?ids=1,2,3.
  const ids = useMemo(() => {
    const batch = search.get("ids");
    if (batch) return batch.split(",").map((s) => Number(s.trim())).filter(Boolean);
    return [Number(id)];
  }, [search, id]);

  const labels = all.filter((p) => ids.includes(p.id));

  if (!hydrated) return <PanelLoading />;

  return (
    <div className="min-h-screen bg-brown-100/40 py-6">
      <style>{`@media print { @page { margin: 8mm; } body { background: #fff; } }`}</style>

      {/* Toolbar — hidden when printing */}
      <div className="mx-auto mb-5 flex w-full max-w-[384px] items-center justify-between print:hidden">
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Close
        </Link>
        <Button onClick={() => window.print()} disabled={labels.length === 0}>
          <Printer className="h-4 w-4" /> Print {labels.length > 1 ? `(${labels.length})` : ""}
        </Button>
      </div>

      {labels.length === 0 ? (
        <p className="text-center text-sm text-brown-500">No parcels found to print.</p>
      ) : (
        <div className="space-y-6 print:space-y-0">
          {labels.map((p) => (
            <div key={p.id} className="break-after-page last:break-after-auto">
              <ShippingLabel parcel={p} />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
