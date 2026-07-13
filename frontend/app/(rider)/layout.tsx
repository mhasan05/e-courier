import type { ReactNode } from "react";
import RiderShell from "@/components/layout/RiderShell";

// Wraps every /rider/* route with the guard + mobile bottom-tab shell.
export default function RiderLayout({ children }: { children: ReactNode }) {
  return <RiderShell>{children}</RiderShell>;
}
