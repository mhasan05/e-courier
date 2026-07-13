// Lightweight class joiner (avoids pulling in clsx for M1).
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(" ");
}

// Format a number as Bangladeshi Taka.
export function formatBDT(amount: number): string {
  return `৳${amount.toLocaleString("en-BD")}`;
}

// Public-facing merchant ID derived from the numeric id, e.g. 1 -> "MCH-0001".
export function merchantCode(id: number): string {
  return `MCH-${String(id).padStart(4, "0")}`;
}

// Public-facing delivery-man ID, e.g. 1 -> "DM-0001".
export function deliveryManCode(id: number): string {
  return `DM-${String(id).padStart(4, "0")}`;
}

// Format an ISO date string as "12 Jun 2025".
export function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

// Format an ISO datetime as "12 Jun 2025, 1:45 PM".
export function formatDateTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    hour12: true,
  });
}
