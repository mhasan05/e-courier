"use client";

import { useTickets } from "@/lib/support-store";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import type { Role } from "@/types";

// Unread/attention counts to badge on sidebar nav items, keyed by href. Used by
// both the desktop Sidebar and the mobile drawer so they stay in sync.
export function useNavBadges(role: Role): Record<string, number> {
  const tickets = useTickets();
  const me = useCurrentMerchant(); // resolves to a fallback for non-merchants (unused)

  const badges: Record<string, number> = {};

  if (role === "admin" || role === "super_admin") {
    const n = tickets.filter((t) => t.unreadForAdmin).length;
    if (n > 0) badges["/admin/support"] = n;
  } else if (role === "merchant") {
    const n = tickets.filter(
      (t) => me != null && t.merchantId === me.id && t.unreadForMerchant,
    ).length;
    if (n > 0) badges["/merchant/support"] = n;
  }

  return badges;
}
