"use client";

import type { ReactNode } from "react";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import ProtectedRoute from "@/components/auth/ProtectedRoute";
import type { Role } from "@/types";

export interface DashboardShellProps {
  role: Role;
  children: ReactNode;
}

// The common authenticated layout: guard + sidebar + topbar + scrollable main.
// The page title is derived from the route inside Topbar.
export default function DashboardShell({ role, children }: DashboardShellProps) {
  return (
    <ProtectedRoute role={role}>
      <div className="flex h-screen overflow-hidden bg-canvas">
        <Sidebar role={role} />
        <div className="flex flex-1 flex-col overflow-hidden">
          <Topbar role={role} />
          <main className="scrollbar-thin flex-1 overflow-y-auto p-5 lg:p-8">
            <div className="mx-auto w-full max-w-[1440px]">{children}</div>
          </main>
        </div>
      </div>
    </ProtectedRoute>
  );
}
