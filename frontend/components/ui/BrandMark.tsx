"use client";

import Image from "next/image";
import { Truck } from "lucide-react";
import { useSiteSettings } from "@/lib/site-settings-store";
import { cn } from "@/lib/utils";

// The company logo when one is set, otherwise the default branded truck badge.
// `className` sizes/rounds the box; pass `iconClass` to size the fallback icon.
export default function BrandMark({
  className,
  iconClass,
}: {
  className?: string;
  iconClass?: string;
}) {
  const { companyName, logoUrl } = useSiteSettings();
  if (logoUrl) {
    return (
      <Image
        src={logoUrl}
        alt={companyName}
        width={64}
        height={64}
        unoptimized
        className={cn("object-contain", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex items-center justify-center bg-gradient-to-br from-primary to-primary-700 text-white",
        className,
      )}
    >
      <Truck className={cn("h-[18px] w-[18px]", iconClass)} />
    </span>
  );
}
