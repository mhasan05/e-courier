import { notFound } from "next/navigation";

// Ownership guard for scoped detail pages (a rider's own parcel, a merchant's own
// ticket, etc.). Throws a 404 unless the entity exists AND belongs to the viewer.
//
// IMPORTANT: call this only AFTER gating on auth `loading` (render <PanelLoading/>
// while loading). On the first render the session — and therefore the owner id —
// is still null; calling notFound() then would 404 the viewer's own record
// permanently. The loading gate prevents that; this helper enforces the rest.
//
// It's a TypeScript assertion function, so after `requireOwned(parcel, ok)` the
// compiler narrows `parcel` to non-null without an extra `if (!parcel)` check.
export function requireOwned<T>(
  entity: T | null | undefined,
  owned: boolean,
): asserts entity is T {
  if (entity == null || !owned) notFound();
}
