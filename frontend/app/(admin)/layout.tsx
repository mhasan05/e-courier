import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";

// Wraps every /admin/* route with the guard, sidebar, and topbar.
export default function AdminLayout({ children }: { children: ReactNode }) {
  return <DashboardShell role="admin">{children}</DashboardShell>;
}
