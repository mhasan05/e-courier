"use client";

import ParcelDetailView from "@/components/parcels/ParcelDetailView";
import { useBranchScope } from "@/hooks/useBranchScope";
import { useAuth } from "@/hooks/useAuth";

export default function BranchParcelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { branchId, branch } = useBranchScope();
  const { name } = useAuth();
  const actor = [name, branch?.name].filter(Boolean).join(" · ") || "Branch";
  return (
    <ParcelDetailView
      parcelId={Number(params.id)}
      backHref="/branch/parcels"
      actor={actor}
      scopeBranchId={branchId}
    />
  );
}
