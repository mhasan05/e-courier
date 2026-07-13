"use client";

// Lightweight localStorage persistence for the in-memory mock stores. Each store
// keeps its existing shape (a module-level array + listeners); this just adds two
// hooks: `persist()` writes the current array, and `hydrate()` loads it once on
// the first client subscribe.
//
// SSR-safe: hydration runs only on the client, after the first render that used
// the seed (matching the server HTML), then notifies listeners to re-render with
// the persisted data — exactly the pattern useSyncExternalStore is built for.
//
// Bump VERSION to invalidate all persisted data when a seed/shape changes.
const VERSION = "v1";

export function storeKey(name: string): string {
  return `cms:${VERSION}:${name}`;
}

export interface Persistence {
  persist: () => void;
  hydrate: () => void;
}

export function persistList<T>(
  name: string,
  read: () => T[],
  write: (next: T[]) => void,
  notify: () => void,
): Persistence {
  const key = storeKey(name);

  const persist = () => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(key, JSON.stringify(read()));
    } catch {
      // Quota exceeded (e.g. large image data URLs) or storage disabled — the
      // store still works in-memory for this session; we just skip persisting.
    }
  };

  let hydrated = false;
  const hydrate = () => {
    if (hydrated || typeof window === "undefined") return;
    hydrated = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) {
        write(JSON.parse(raw) as T[]);
        notify();
      }
    } catch {
      // Corrupt JSON or read error — fall back to the in-memory seed.
    }
  };

  return { persist, hydrate };
}

// Clear all persisted mock data (handy for a dev "reset demo data" action).
export function clearPersistedStores(): void {
  if (typeof window === "undefined") return;
  const prefix = `cms:${VERSION}:`;
  Object.keys(window.localStorage)
    .filter((k) => k.startsWith(prefix))
    .forEach((k) => window.localStorage.removeItem(k));
}
