"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { homeForRole } from "@/lib/auth";
import type { Role } from "@/types";

export interface ProtectedRouteProps {
  role: Role; // the role this section requires
  children: ReactNode;
}

// A super_admin can access everything an admin can.
function roleSatisfies(sessionRole: string, required: string): boolean {
  if (sessionRole === required) return true;
  return required === "admin" && sessionRole === "super_admin";
}

// Client-side route guard: checks the localStorage session and redirects to
// /login when missing, or to the user's own home when the role mismatches.
export default function ProtectedRoute({ role, children }: ProtectedRouteProps) {
  const router = useRouter();
  const { session, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace("/login");
    } else if (!roleSatisfies(session.role, role)) {
      router.replace(homeForRole(session.role));
    }
  }, [loading, session, role, router]);

  if (loading || !session || !roleSatisfies(session.role, role)) {
    return (
      <div className="flex h-screen items-center justify-center bg-canvas">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return <>{children}</>;
}
