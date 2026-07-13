import type { ReactNode } from "react";
import DashboardShell from "@/components/layout/DashboardShell";

// Wraps every /branch/* route with the guard, sidebar, and topbar for the
// Branch Manager role. All pages inside are hard-scoped to the manager's hub.
export default function BranchLayout({ children }: { children: ReactNode }) {
  return <DashboardShell role="branch_manager">{children}</DashboardShell>;
}
