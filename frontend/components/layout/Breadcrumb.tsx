"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight } from "lucide-react";

// Derives a breadcrumb trail from the current pathname segments.
export default function Breadcrumb() {
  const pathname = usePathname();
  const segments = pathname.split("/").filter(Boolean);

  const crumbs = segments.map((seg, i) => {
    const href = "/" + segments.slice(0, i + 1).join("/");
    const label = seg
      .replace(/-/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return { href, label, isLast: i === segments.length - 1 };
  });

  return (
    <nav className="flex items-center gap-1 text-xs text-brown-500">
      {crumbs.map((c) => (
        <span key={c.href} className="flex items-center gap-1">
          {c.isLast ? (
            <span className="font-medium text-brown-600">{c.label}</span>
          ) : (
            <Link href={c.href} className="hover:text-primary">
              {c.label}
            </Link>
          )}
          {!c.isLast && <ChevronRight className="h-3 w-3" />}
        </span>
      ))}
    </nav>
  );
}
