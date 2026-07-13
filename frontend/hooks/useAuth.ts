"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession, clearSession } from "@/lib/auth";
import { clearTokens } from "@/lib/api";
import type { AuthSession } from "@/types";

// Reads the current session from localStorage and exposes role + user info.
// In M4 this will decode the JWT payload instead of reading the mock session.
export function useAuth() {
  const router = useRouter();
  const [session, setSessionState] = useState<AuthSession | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setSessionState(getSession());
    setLoading(false);
  }, []);

  const logout = useCallback(() => {
    clearSession();
    clearTokens();
    setSessionState(null);
    router.replace("/");
  }, [router]);

  return {
    session,
    role: session?.role ?? null,
    name: session?.name ?? null,
    email: session?.email ?? null,
    branchId: session?.branchId ?? null,
    deliveryManId: session?.deliveryManId ?? null,
    isAuthenticated: !!session,
    loading,
    logout,
  };
}
