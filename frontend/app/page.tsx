import Link from "next/link";
import {
  Banknote,
  MapPinned,
  Truck,
  LayoutDashboard,
  ShieldCheck,
  Headphones,
  UserPlus,
  PackagePlus,
  Bike,
  CheckCircle2,
  TrendingUp,
  ArrowRight,
  Star,
  Clock,
} from "lucide-react";
import LandingNav from "@/components/landing/LandingNav";
import TrackInput from "@/components/landing/TrackInput";
import Faq from "@/components/landing/Faq";
import Footer from "@/components/landing/Footer";

const FEATURES = [
  { icon: Banknote, title: "Cash on Delivery", desc: "Collect COD from customers and get fast, reliable disbursements to your account." },
  { icon: MapPinned, title: "Real-time Tracking", desc: "Every parcel gets a live tracking page so you and your customers always know where it is." },
  { icon: Truck, title: "Dhaka-wide Delivery", desc: "Fast door-to-door delivery across every area of Dhaka city — Uttara to Motijheel." },
  { icon: LayoutDashboard, title: "Merchant Dashboard", desc: "Book, import in bulk, manage parcels, and view reports — all from one powerful panel." },
  { icon: ShieldCheck, title: "Secure & Insured", desc: "Your parcels are handled with care and covered every step of the journey." },
  { icon: Headphones, title: "Dedicated Support", desc: "A responsive support team ready to help you and your customers whenever you need." },
];

const STEPS = [
  { icon: UserPlus, title: "Sign up", desc: "Register your shop and get approved by our team." },
  { icon: PackagePlus, title: "Book a parcel", desc: "Add recipient details — we calculate the charge instantly." },
  { icon: Bike, title: "We pick up", desc: "Our rider collects the parcel from your pickup address." },
  { icon: CheckCircle2, title: "We deliver", desc: "Fast delivery with live tracking until it reaches your customer." },
  { icon: Banknote, title: "Get your COD", desc: "We collect the cash and disburse it straight to you." },
];

const STATS = [
  { value: "2.5M+", label: "Parcels Delivered" },
  { value: "12K+", label: "Active Merchants" },
  { value: "14+", label: "Dhaka Areas Covered" },
  { value: "98%", label: "Delivery Success" },
];

const DIVISIONS = ["Mirpur", "Gulshan", "Uttara", "Dhanmondi", "Mohammadpur", "Motijheel", "Ramna", "Savar"];

const TESTIMONIALS = [
  { name: "Abdul Karim", shop: "Karim Traders", quote: "Switching over doubled our delivery success rate. The COD disbursement is always on time." },
  { name: "Nusrat Jahan", shop: "Nusrat Beauty Hub", quote: "The dashboard makes managing hundreds of parcels effortless. My customers love the live tracking." },
  { name: "Rakibul Hasan", shop: "Gadget Bazaar BD", quote: "Nationwide coverage and fast pickups helped us expand beyond Dhaka. Highly recommended for any online shop." },
];

export default function HomePage() {
  return (
    <div className="bg-canvas">
      <LandingNav />

      {/* ── Hero ───────────────────────────────────────────── */}
      <section className="relative overflow-hidden">
        {/* Soft, clean backdrop: faded grid + a single primary glow */}
        <div className="bg-grid pointer-events-none absolute inset-0 opacity-60 [mask-image:radial-gradient(ellipse_60%_50%_at_50%_0%,black,transparent)]" />
        <div className="pointer-events-none absolute left-1/2 top-[-10%] h-[420px] w-[720px] -translate-x-1/2 rounded-full bg-primary-200/40 blur-[120px]" />

        <div className="relative mx-auto max-w-3xl px-4 pb-14 pt-20 text-center lg:pt-28">
          <Link
            href="/signup"
            className="inline-flex items-center gap-2 rounded-full border border-brown-200 bg-white/80 py-1 pl-1.5 pr-3 text-xs font-medium text-brown-600 shadow-sm backdrop-blur transition-colors hover:border-primary-200 hover:text-brown-900"
          >
            <span className="rounded-full bg-primary px-2 py-0.5 text-[11px] font-semibold text-white">
              New
            </span>
            Now live across Dhaka city
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>

          <h1 className="mt-6 text-4xl font-semibold leading-[1.08] tracking-tight text-brown-900 sm:text-5xl lg:text-[3.5rem]">
            Deliver anywhere in Dhaka,{" "}
            <span className="text-primary">hassle-free.</span>
          </h1>

          <p className="mx-auto mt-5 max-w-xl text-lg leading-relaxed text-brown-500">
            The complete courier platform for online businesses — book parcels,
            collect cash on delivery, and track every shipment in real time.
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
            <Link
              href="/signup"
              className="inline-flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-semibold text-white shadow-sm shadow-primary-900/20 transition-all hover:bg-primary-700 hover:shadow-md"
            >
              Become a Merchant <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 rounded-xl border border-brown-200 bg-white px-6 py-3 text-sm font-semibold text-brown-700 transition-colors hover:border-brown-300 hover:bg-brown-50"
            >
              Merchant Login
            </Link>
          </div>

          {/* Track input */}
          <div className="mx-auto mt-6 flex max-w-md justify-center">
            <TrackInput />
          </div>

          {/* Trust line */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-sm text-brown-500">
            <span className="flex items-center gap-0.5 text-amber">
              {Array.from({ length: 5 }).map((_, i) => (
                <Star key={i} className="h-4 w-4 fill-current" />
              ))}
            </span>
            <span>
              Trusted by <span className="font-semibold text-brown-900">12,000+</span> merchants
            </span>
          </div>
        </div>

        {/* Product preview */}
        <div className="relative mx-auto max-w-4xl px-4 pb-20">
          <ProductPreview />
        </div>
      </section>

      {/* ── Stats band ─────────────────────────────────────── */}
      <section className="border-y border-brown-100 bg-white">
        <div className="mx-auto grid max-w-5xl grid-cols-2 divide-x divide-y divide-brown-100 sm:grid-cols-4 sm:divide-y-0">
          {STATS.map((s) => (
            <div key={s.label} className="px-4 py-8 text-center">
              <p className="text-3xl font-semibold tracking-tight text-brown-900">{s.value}</p>
              <p className="mt-1 text-sm text-brown-500">{s.label}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Features ───────────────────────────────────────── */}
      <section id="features" className="mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          eyebrow="Features"
          title="Everything you need to deliver"
          subtitle="A full logistics toolkit built for Bangladeshi e-commerce."
        />
        <div className="mt-14 grid grid-cols-1 gap-x-8 gap-y-10 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => {
            const Icon = f.icon;
            return (
              <div key={f.title} className="group">
                <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-primary-50 text-primary ring-1 ring-primary-100 transition-transform group-hover:scale-105">
                  <Icon className="h-[22px] w-[22px]" />
                </span>
                <h3 className="mt-5 text-base font-semibold text-brown-900">{f.title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-brown-500">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* ── How it works ───────────────────────────────────── */}
      <section id="how" className="border-y border-brown-100 bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="How it works"
            title="From booking to doorstep in 5 steps"
            subtitle="Get started in minutes and let us handle the logistics."
          />
          <div className="relative mt-14 grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5">
            {/* connecting hairline on desktop */}
            <div className="absolute left-0 right-0 top-6 hidden h-px bg-brown-100 lg:block" />
            {STEPS.map((s, i) => {
              const Icon = s.icon;
              return (
                <div key={s.title} className="relative text-center">
                  <span className="relative z-10 mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-brown-100 bg-white text-primary shadow-sm">
                    <Icon className="h-[22px] w-[22px]" />
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-white">
                      {i + 1}
                    </span>
                  </span>
                  <h3 className="mt-4 font-semibold text-brown-900">{s.title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-brown-500">{s.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ── Coverage ───────────────────────────────────────── */}
      <section id="coverage" className="mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          eyebrow="Coverage"
          title="We cover all of Dhaka"
          subtitle="Every corner of the city — Uttara to Motijheel, Mirpur to Gulshan."
        />
        <div className="mt-12 grid grid-cols-2 gap-3 sm:grid-cols-4">
          {DIVISIONS.map((d) => (
            <div
              key={d}
              className="flex items-center gap-2.5 rounded-xl border border-brown-100 bg-white px-4 py-3.5 transition-colors hover:border-primary-200 hover:bg-primary-50/40"
            >
              <MapPinned className="h-[18px] w-[18px] text-primary" />
              <span className="text-sm font-medium text-brown-800">{d}</span>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials ───────────────────────────────────── */}
      <section className="border-y border-brown-100 bg-white py-24">
        <div className="mx-auto max-w-6xl px-4">
          <SectionHeading
            eyebrow="Testimonials"
            title="Loved by merchants nationwide"
            subtitle="See why thousands of online businesses trust us with their deliveries."
          />
          <div className="mt-14 grid grid-cols-1 gap-6 md:grid-cols-3">
            {TESTIMONIALS.map((t) => (
              <figure
                key={t.name}
                className="flex flex-col rounded-2xl border border-brown-100 bg-canvas/50 p-6"
              >
                <div className="flex gap-0.5 text-amber">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-4 w-4 fill-current" />
                  ))}
                </div>
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed text-brown-700">
                  “{t.quote}”
                </blockquote>
                <figcaption className="mt-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-sm font-semibold text-white">
                    {t.name.charAt(0)}
                  </span>
                  <div>
                    <p className="text-sm font-semibold text-brown-900">{t.name}</p>
                    <p className="text-xs text-brown-500">{t.shop}</p>
                  </div>
                </figcaption>
              </figure>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ────────────────────────────────────────────── */}
      <section id="faq" className="mx-auto max-w-6xl px-4 py-24">
        <SectionHeading
          eyebrow="FAQ"
          title="Frequently asked questions"
          subtitle="Everything you need to know before getting started."
        />
        <div className="mt-12">
          <Faq />
        </div>
      </section>

      {/* ── Final CTA ──────────────────────────────────────── */}
      <section className="px-4 pb-24">
        <div className="relative mx-auto max-w-5xl overflow-hidden rounded-3xl bg-gradient-to-br from-primary-700 via-primary to-primary-700 px-6 py-16 text-center text-white">
          <div className="bg-grid pointer-events-none absolute inset-0 opacity-[0.12]" />
          <div className="pointer-events-none absolute -right-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" />
          <div className="relative mx-auto max-w-xl">
            <h2 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              Ready to grow your business?
            </h2>
            <p className="mt-3 text-primary-50">
              Join thousands of merchants delivering smarter.
              Sign up today — approval in 24 hours.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/signup"
                className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-3 text-sm font-semibold text-primary-700 shadow-lg shadow-primary-900/30 transition hover:bg-primary-50"
              >
                Become a Merchant <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/track"
                className="inline-flex items-center gap-2 rounded-xl border border-white/30 px-6 py-3 text-sm font-semibold text-white transition hover:bg-white/10"
              >
                Track a Parcel
              </Link>
            </div>
          </div>
        </div>
      </section>

      <Footer />
    </div>
  );
}

// A clean "product shot" — the live parcel-tracking card, floated with two accent chips.
function ProductPreview() {
  return (
    <div className="relative mx-auto max-w-xl">
      {/* Floating: delivered */}
      <div className="absolute -left-4 top-8 z-20 hidden items-center gap-2 rounded-xl border border-brown-100 bg-white px-3 py-2 shadow-lg sm:flex">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-success-50 text-success-600">
          <CheckCircle2 className="h-4 w-4" />
        </span>
        <div className="leading-tight">
          <p className="text-xs font-semibold text-brown-900">Delivered</p>
          <p className="text-[10px] text-brown-400">+2,480 parcels today</p>
        </div>
      </div>

      {/* Floating: on-time */}
      <div className="absolute -bottom-4 -right-4 z-20 hidden items-center gap-2 rounded-xl bg-brown-900 px-3 py-2 text-white shadow-lg sm:flex">
        <TrendingUp className="h-4 w-4 text-success-500" />
        <div className="leading-tight">
          <p className="text-sm font-semibold">98%</p>
          <p className="text-[10px] text-brown-300">On-time rate</p>
        </div>
      </div>

      {/* Card */}
      <div className="relative z-10 rounded-2xl border border-brown-100 bg-white p-5 shadow-xl shadow-brown-900/[0.06]">
        <div className="flex items-center justify-between">
          <span className="font-mono text-xs text-brown-500">CMS-2025-100006</span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-violet-100 px-2.5 py-0.5 text-xs font-medium text-violet-700">
            <span className="h-1.5 w-1.5 rounded-full bg-violet-500" /> Out for Delivery
          </span>
        </div>

        {/* Mini route map */}
        <div className="mt-4 overflow-hidden rounded-xl bg-[#f0f9e8]">
          <svg viewBox="0 0 320 120" className="h-28 w-full">
            <defs>
              <pattern id="hgrid" width="24" height="24" patternUnits="userSpaceOnUse">
                <path d="M 24 0 L 0 0 0 24" fill="none" stroke="#e2e8f0" strokeWidth="1" />
              </pattern>
            </defs>
            <rect width="320" height="120" fill="url(#hgrid)" />
            <path d="M 30 92 Q 160 14 250 70" fill="none" stroke="#bfdbfe" strokeWidth="4" strokeLinecap="round" />
            <path d="M 30 92 Q 120 40 175 52" fill="none" stroke="#38961c" strokeWidth="4" strokeLinecap="round" />
            <circle cx="30" cy="92" r="6" fill="#0f172a" />
            <circle cx="250" cy="70" r="6" fill="#7C3AED" />
            <circle cx="175" cy="52" r="11" fill="#38961c" />
          </svg>
        </div>

        {/* Rider */}
        <div className="mt-4 flex items-center gap-3 rounded-xl bg-canvas p-3">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-700 text-white">
            <Bike className="h-5 w-5" />
          </span>
          <div className="flex-1">
            <p className="text-sm font-medium text-brown-900">Rofiqul Islam</p>
            <p className="text-xs text-brown-500">Your delivery rider</p>
          </div>
          <span className="flex items-center gap-1 rounded-lg bg-primary-50 px-2 py-1 text-xs font-medium text-primary-700">
            <Clock className="h-3.5 w-3.5" /> ~25 min
          </span>
        </div>

        {/* Steps */}
        <div className="mt-4 grid grid-cols-4 gap-1">
          {[
            ["Picked up", true],
            ["In transit", true],
            ["Out", true],
            ["Delivered", false],
          ].map(([label, done], i) => (
            <div key={i} className="text-center">
              <span
                className={`mx-auto flex h-6 w-6 items-center justify-center rounded-full ${done ? "bg-primary text-white" : "bg-brown-100 text-brown-400"}`}
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
              </span>
              <p className={`mt-1 text-[10px] ${done ? "text-brown-600" : "text-brown-400"}`}>
                {label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function SectionHeading({
  eyebrow,
  title,
  subtitle,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center text-center">
      <span className="inline-flex items-center rounded-full border border-primary-100 bg-primary-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.08em] text-primary-700">
        {eyebrow}
      </span>
      <h2 className="mt-4 text-3xl font-semibold tracking-tight text-brown-900 sm:text-[2rem]">
        {title}
      </h2>
      <p className="mt-3 text-brown-500">{subtitle}</p>
    </div>
  );
}
