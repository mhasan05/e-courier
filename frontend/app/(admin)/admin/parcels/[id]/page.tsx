"use client";

import ParcelDetailView from "@/components/parcels/ParcelDetailView";
import { useAuth } from "@/hooks/useAuth";

export default function AdminParcelDetailPage({
  params,
}: {
  params: { id: string };
}) {
  const { name } = useAuth();
  const actor = name ? `${name} · HQ` : "Admin";
  return (
    <ParcelDetailView
      parcelId={Number(params.id)}
      backHref="/admin/parcels"
      actor={actor}
    />
  );
}
