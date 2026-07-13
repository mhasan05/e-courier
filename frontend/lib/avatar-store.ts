"use client";

import { useSyncExternalStore } from "react";

// Per-user profile picture, stored as a data URL in localStorage keyed by email
// so each account keeps its own avatar. Reactive via useSyncExternalStore so the
// topbar updates the moment a user changes their picture. (A real backend would
// upload the image and return a URL — this swaps in cleanly there.)

const listeners = new Set<() => void>();
const emit = () => listeners.forEach((l) => l());
const subscribe = (l: () => void) => {
  listeners.add(l);
  return () => listeners.delete(l);
};

const keyFor = (email: string) => `cms_avatar:${email}`;

export function getAvatar(email?: string | null): string | null {
  if (typeof window === "undefined" || !email) return null;
  return localStorage.getItem(keyFor(email));
}

export function setAvatar(email: string, dataUrl: string): void {
  if (typeof window === "undefined" || !email) return;
  localStorage.setItem(keyFor(email), dataUrl);
  emit();
}

export function removeAvatar(email: string): void {
  if (typeof window === "undefined" || !email) return;
  localStorage.removeItem(keyFor(email));
  emit();
}

export function useAvatar(email?: string | null): string | null {
  return useSyncExternalStore(
    subscribe,
    () => getAvatar(email),
    () => null,
  );
}
