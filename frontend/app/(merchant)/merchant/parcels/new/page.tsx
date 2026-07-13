"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  User,
  Phone,
  Mail,
  Package,
  Weight,
  Banknote,
  FileText,
  Repeat,
  ShoppingBag,
  Clock,
  Truck,
  ShieldCheck,
  PackageCheck,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Button from "@/components/ui/Button";
import RecipientRisk from "@/components/parcels/RecipientRisk";
import { useToast } from "@/components/ui/Toast";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import {
  addParcel,
  bookParcel,
  generateTrackingId,
  nextParcelId,
} from "@/lib/parcel-store";
import { apiEnabled } from "@/lib/api";
import { findZoneByDistrict, computeCharge } from "@/lib/charges";
import { resolveOriginHub, resolveDestinationHub, coverageThanas } from "@/lib/hubs";
import { useBranches } from "@/lib/branch-store";
import { SERVICE_DISTRICTS } from "@/lib/constants";
import { formatBDT } from "@/lib/utils";
import type { DeliveryMethod, Parcel } from "@/types";

interface FormState {
  deliveryMethod: DeliveryMethod;
  phone: string;
  name: string;
  address: string;
  district: string;
  thana: string;
  alternativePhone: string;
  recipientEmail: string;
  codAmount: string;
  invoiceNumber: string;
  itemDescription: string;
  note: string;
  weight: string;
  isExchange: boolean;
}

const initialForm: FormState = {
  deliveryMethod: "home",
  phone: "",
  name: "",
  address: "",
  district: "Dhaka", // Dhaka-only service area for now
  thana: "",
  alternativePhone: "",
  recipientEmail: "",
  codAmount: "",
  invoiceNumber: "",
  itemDescription: "",
  note: "",
  weight: "0.5",
  isExchange: false,
};

export default function NewParcelPage() {
  const router = useRouter();
  const toast = useToast();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const [form, setForm] = useState<FormState>(initialForm);
  const [submitting, setSubmitting] = useState(false);
  const branches = useBranches();

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // Changing district resets the dependent Thana selection.
  const setDistrict = (value: string) =>
    setForm((f) => ({ ...f, district: value, thana: "" }));

  // Delivery areas come from the hubs' live coverage — not a static list.
  const thanaOptions = form.district ? coverageThanas(branches, form.district) : [];

  // Live charge preview based on the resolved zone for the chosen district.
  const charge = useMemo(() => {
    if (!form.district) return null;
    const zone = findZoneByDistrict(form.district);
    // Express-only for now (standard delivery to be added later).
    return computeCharge(
      zone,
      "express",
      Number(form.weight) || 0,
      Number(form.codAmount) || 0,
    );
  }, [form.district, form.weight, form.codAmount]);

  const submit = async () => {
    if (
      !form.phone.trim() ||
      !form.name.trim() ||
      !form.address.trim() ||
      !form.district ||
      !form.thana
    ) {
      toast.error("Please fill in all required fields");
      return;
    }

    // API path — the server computes charges, hub routing and OTP.
    if (apiEnabled()) {
      setSubmitting(true);
      try {
        const created = await bookParcel({
          recipientName: form.name.trim(),
          recipientPhone: form.phone.trim(),
          alternativePhone: form.alternativePhone.trim() || undefined,
          recipientEmail: form.recipientEmail.trim() || undefined,
          recipientAddress: form.address.trim(),
          district: form.district,
          upazila: form.thana,
          deliveryMethod: form.deliveryMethod,
          weight: Number(form.weight) || 0,
          productDescription: form.itemDescription.trim(),
          specialInstructions: form.note.trim() || undefined,
          invoiceNumber: form.invoiceNumber.trim() || undefined,
          isExchange: form.isExchange,
          codAmount: Number(form.codAmount) || 0,
        });
        toast.success(`Parcel booked${created ? ` — ${created.trackingId}` : ""}`);
        router.push("/merchant/parcels");
      } catch {
        toast.error("Could not book the parcel. Check the details and try again.");
        setSubmitting(false);
      }
      return;
    }

    if (!charge) return;

    setSubmitting(true);
    const trackingId = generateTrackingId();
    const now = new Date().toISOString();
    const originHub = resolveOriginHub(me);
    const destinationHub = resolveDestinationHub(form.district, form.thana);
    if (!originHub || !destinationHub) {
      toast.error("Hubs are still loading — please try again in a moment.");
      setSubmitting(false);
      return;
    }
    const parcel: Parcel = {
      id: nextParcelId(),
      trackingId,
      merchantId: me.id,
      merchantName: me.shopName,
      recipientName: form.name.trim(),
      recipientPhone: form.phone.trim(),
      alternativePhone: form.alternativePhone.trim() || undefined,
      recipientEmail: form.recipientEmail.trim() || undefined,
      recipientAddress: form.address.trim(),
      district: form.district,
      upazila: form.thana,
      zone: charge.zoneName,
      originBranchId: originHub.id,
      destinationBranchId: destinationHub.id,
      currentBranchId: originHub.id,
      ownerBranchId: me.homeBranchId ?? originHub.id,
      deliveryType: "express",
      deliveryMethod: form.deliveryMethod,
      weight: Number(form.weight) || 0,
      productDescription: form.itemDescription.trim(),
      specialInstructions: form.note.trim() || undefined,
      invoiceNumber: form.invoiceNumber.trim() || undefined,
      isExchange: form.isExchange,
      codAmount: Number(form.codAmount) || 0,
      deliveryCharge: charge.deliveryCharge,
      codCharge: charge.codCharge,
      totalCharge: charge.totalCharge,
      status: "pending",
      createdAt: now.slice(0, 10),
      history: [{ status: "pending", changedBy: "Merchant", timestamp: now }],
    };
    addParcel(parcel);
    toast.success(`Parcel booked — ${trackingId}`);
    router.push("/merchant/parcels");
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6">
      {/* Header */}
      <div>
        <Link
          href="/merchant/parcels"
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to parcels
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight text-brown-800">Book a Parcel</h1>
        <p className="text-sm text-brown-500">
          Enter the recipient and parcel details — the delivery charge is calculated automatically.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        {/* Form */}
        <div className="space-y-6 lg:col-span-2">
          {/* Recipient */}
          <Card title={<SectionTitle icon={User} text="Recipient Details" />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Phone *"
                leftIcon={<Phone className="h-4 w-4" />}
                value={form.phone}
                onChange={(e) => set("phone", e.target.value)}
                placeholder="01XXXXXXXXX"
              />
              <Input
                label="Recipient Name *"
                leftIcon={<User className="h-4 w-4" />}
                value={form.name}
                onChange={(e) => set("name", e.target.value)}
                placeholder="Full name"
              />
              <div className="sm:col-span-2">
                <RecipientRisk phone={form.phone} />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Address *"
                  rows={2}
                  value={form.address}
                  onChange={(e) => set("address", e.target.value)}
                  placeholder="House, road, area"
                />
              </div>
              <Select
                label="District *"
                value={form.district}
                onChange={(e) => setDistrict(e.target.value)}
                placeholder="Select district"
                options={SERVICE_DISTRICTS.map((d) => ({ value: d, label: d }))}
              />
              <Select
                label="Thana *"
                value={form.thana}
                onChange={(e) => set("thana", e.target.value)}
                placeholder={form.district ? "Select thana" : "Select district first"}
                disabled={!form.district}
                options={thanaOptions.map((t) => ({ value: t, label: t }))}
              />
              <Input
                label="Alternative Phone"
                leftIcon={<Phone className="h-4 w-4" />}
                value={form.alternativePhone}
                onChange={(e) => set("alternativePhone", e.target.value)}
                placeholder="Optional"
              />
              <Input
                label="Recipient Email"
                type="email"
                leftIcon={<Mail className="h-4 w-4" />}
                value={form.recipientEmail}
                onChange={(e) => set("recipientEmail", e.target.value)}
                placeholder="Optional"
              />
            </div>
          </Card>

          {/* Parcel */}
          <Card title={<SectionTitle icon={Package} text="Parcel Details" />}>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                label="Weight (KG)"
                type="number"
                step="0.1"
                leftIcon={<Weight className="h-4 w-4" />}
                value={form.weight}
                onChange={(e) => set("weight", e.target.value)}
              />
              <Input
                label="COD Amount"
                type="number"
                leftIcon={<Banknote className="h-4 w-4" />}
                value={form.codAmount}
                onChange={(e) => set("codAmount", e.target.value)}
                placeholder="0 for non-COD"
              />
              <Input
                label="Invoice"
                leftIcon={<FileText className="h-4 w-4" />}
                value={form.invoiceNumber}
                onChange={(e) => set("invoiceNumber", e.target.value)}
                placeholder="Invoice no. (if any)"
              />
              <div className="hidden sm:block" />
              <div className="sm:col-span-2">
                <Textarea
                  label="Item Description"
                  maxLength={400}
                  value={form.itemDescription}
                  onChange={(e) => set("itemDescription", e.target.value)}
                  placeholder="What's inside? (max. 400 chars)"
                />
              </div>
              <div className="sm:col-span-2">
                <Textarea
                  label="Note"
                  maxLength={400}
                  value={form.note}
                  onChange={(e) => set("note", e.target.value)}
                  placeholder="Special delivery instructions (max. 400 chars)"
                />
              </div>
              <div className="sm:col-span-2">
                <label className="flex cursor-pointer items-center justify-between rounded-xl border border-brown-200 px-4 py-3 hover:bg-brown-50">
                  <span className="flex items-center gap-3">
                    <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-warning-50 text-warning-600">
                      <Repeat className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-brown-800">
                        Exchange Parcel
                      </span>
                      <span className="block text-xs text-brown-500">
                        Collect an item from the recipient in return
                      </span>
                    </span>
                  </span>
                  <input
                    type="checkbox"
                    checked={form.isExchange}
                    onChange={(e) => set("isExchange", e.target.checked)}
                    className="h-4 w-4 accent-primary"
                  />
                </label>
              </div>
            </div>
          </Card>
        </div>

        {/* Order summary */}
        <div className="lg:col-span-1">
          <div className="space-y-4 lg:sticky lg:top-5">
            <Card title={<SectionTitle icon={ShoppingBag} text="Order Summary" />}>
              {charge ? (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 rounded-lg bg-canvas px-3 py-2.5 text-sm">
                    <MapPin className="h-4 w-4 text-amber" />
                    <span className="text-brown-500">Destination</span>
                    <span className="ml-auto font-medium text-brown-800">
                      {charge.zoneName}
                    </span>
                  </div>

                  <dl className="space-y-2 text-sm">
                    <SummaryRow label="Delivery charge" value={formatBDT(charge.deliveryCharge)} />
                    <SummaryRow
                      label="COD charge"
                      value={charge.codCharge > 0 ? formatBDT(charge.codCharge) : "—"}
                    />
                    <div className="my-2 border-t border-dashed border-brown-200" />
                    <div className="flex items-center justify-between">
                      <dt className="font-semibold text-brown-800">Total Charge</dt>
                      <dd className="text-xl font-semibold tracking-tight text-primary">
                        {formatBDT(charge.totalCharge)}
                      </dd>
                    </div>
                  </dl>

                  <div className="space-y-2 border-t border-brown-100 pt-3 text-xs text-brown-500">
                    <p className="flex items-center gap-2">
                      <Truck className="h-3.5 w-3.5 text-primary" /> Express home delivery
                    </p>
                    <p className="flex items-center gap-2">
                      <Clock className="h-3.5 w-3.5 text-primary" /> Estimated 1–2 days
                    </p>
                    <p className="flex items-center gap-2">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" /> Insured &amp; trackable
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center py-6 text-center">
                  <span className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-canvas text-brown-400">
                    <ShoppingBag className="h-6 w-6" />
                  </span>
                  <p className="text-sm text-brown-500">
                    Select a district to see your delivery charge.
                  </p>
                </div>
              )}
            </Card>

            <Button
              onClick={submit}
              loading={submitting}
              size="lg"
              className="w-full"
            >
              <PackageCheck className="h-5 w-5" /> Confirm Booking
            </Button>
            <p className="text-center text-xs text-brown-500">
              * PickUp Time <span className="font-medium text-primary">4pm–7pm</span> Approx.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon: Icon, text }: { icon: LucideIcon; text: string }) {
  return (
    <span className="flex items-center gap-2 text-brown-700">
      <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary-50 text-primary">
        <Icon className="h-4 w-4" />
      </span>
      {text}
    </span>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between">
      <dt className="text-brown-500">{label}</dt>
      <dd className="font-medium text-brown-700">{value}</dd>
    </div>
  );
}
