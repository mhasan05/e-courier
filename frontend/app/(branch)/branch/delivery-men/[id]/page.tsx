"use client";

import DeliveryManDetail from "@/components/riders/DeliveryManDetail";

export default function BranchDeliveryManDetailPage({
  params,
}: {
  params: { id: string };
}) {
  // Hub managers manage only their own hub's riders (backend-scoped) and cannot
  // reassign a rider to another hub.
  return (
    <DeliveryManDetail
      id={Number(params.id)}
      basePath="/branch"
      allowHubReassign={false}
    />
  );
}
