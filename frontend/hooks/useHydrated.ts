"use client";

import { useEffect, useState } from "react";

// True only after the component has mounted on the client. The persisted mock
// stores hydrate from localStorage on their first subscribe (post-mount), so a
// detail page that looks up an entity by id and 404s on its first render would
// miss records that exist only in localStorage (created in a prior session).
// Gate such pages on this: `if (!useHydrated()) return <PanelLoading/>;` before
// the notFound() check.
export function useHydrated(): boolean {
  const [hydrated, setHydrated] = useState(false);
  useEffect(() => setHydrated(true), []);
  return hydrated;
}
