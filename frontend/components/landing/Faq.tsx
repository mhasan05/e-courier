"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "How do I become a merchant?",
    a: "Click \"Become a Merchant\", fill in your shop details, and submit. Our team reviews and approves new merchants — usually within 24 hours. Once approved, you can start booking parcels right away.",
  },
  {
    q: "How does Cash on Delivery (COD) work?",
    a: "We collect the COD amount from your customer at delivery and disburse it to your account on a regular cycle. A small 1% COD handling charge applies (minimum ৳10).",
  },
  {
    q: "Which areas do you cover?",
    a: "We currently deliver across Dhaka city and its surrounding areas (Savar, Keraniganj, Dhamrai, Dohar). We're expanding to more districts soon.",
  },
  {
    q: "How long does delivery take?",
    a: "Within Dhaka, most parcels are delivered within 24 hours. Express same-day delivery is available in core city areas.",
  },
  {
    q: "Can my customers track their parcel?",
    a: "Yes. Every parcel gets a unique tracking ID with a live tracking page showing real-time status and the assigned delivery rider's contact.",
  },
  {
    q: "What are the delivery charges?",
    a: "Charges start at ৳60 inside Dhaka city and ৳80 for surrounding areas. After signing in, use the in-app price calculator for an exact quote by area.",
  },
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <div className="mx-auto max-w-3xl space-y-3">
      {FAQS.map((item, i) => {
        const isOpen = open === i;
        return (
          <div
            key={i}
            className="overflow-hidden rounded-xl border border-brown-100 bg-white"
          >
            <button
              onClick={() => setOpen(isOpen ? null : i)}
              className="flex w-full items-center justify-between gap-3 px-5 py-4 text-left"
            >
              <span className="font-medium text-brown-800">{item.q}</span>
              <ChevronDown
                className={cn(
                  "h-5 w-5 shrink-0 text-brown-500 transition-transform",
                  isOpen && "rotate-180",
                )}
              />
            </button>
            {isOpen && (
              <p className="px-5 pb-5 text-sm leading-relaxed text-brown-500">
                {item.a}
              </p>
            )}
          </div>
        );
      })}
    </div>
  );
}
