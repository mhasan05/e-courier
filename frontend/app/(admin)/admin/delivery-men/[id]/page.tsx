"use client";

import DeliveryManDetail from "@/components/riders/DeliveryManDetail";

export default function AdminDeliveryManDetailPage({
  params,
}: {
  params: { id: string };
}) {
  return (
    <DeliveryManDetail id={Number(params.id)} basePath="/admin" allowHubReassign />
  );
}
