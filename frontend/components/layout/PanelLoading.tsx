import { Loader2 } from "lucide-react";

// Shared centered loader for pages that must wait for the session to load before
// deciding scope (see lib/scope.ts). Keeps the gate visually consistent.
export default function PanelLoading() {
  return (
    <div className="flex items-center justify-center py-16 text-brown-400">
      <Loader2 className="h-6 w-6 animate-spin" />
    </div>
  );
}
