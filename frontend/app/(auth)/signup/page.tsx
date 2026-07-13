"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Truck } from "lucide-react";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { useToast } from "@/components/ui/Toast";
import { BD_DISTRICTS } from "@/lib/constants";
import { apiEnabled, ApiError } from "@/lib/api";
import { registerMerchant } from "@/lib/api/auth";

interface SignupForm {
  shopName: string;
  ownerName: string;
  email: string;
  phone: string;
  password: string;
  confirm: string;
  district: string;
  businessType: string;
  pickupAddress: string;
}

const empty: SignupForm = {
  shopName: "",
  ownerName: "",
  email: "",
  phone: "",
  password: "",
  confirm: "",
  district: "",
  businessType: "",
  pickupAddress: "",
};

// Merchant self-registration. Uses the real Django API (POST /auth/register/)
// when NEXT_PUBLIC_API_URL is set — new merchants are created with status
// PENDING and must be approved by an admin. Falls back to a mock success when
// no API is configured, so the demo still works standalone.
export default function SignupPage() {
  const router = useRouter();
  const toast = useToast();
  const [form, setForm] = useState<SignupForm>(empty);
  const [loading, setLoading] = useState(false);

  const set = (key: keyof SignupForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (
      !form.shopName.trim() ||
      !form.ownerName.trim() ||
      !form.email.trim() ||
      !form.phone.trim() ||
      !form.district ||
      !form.pickupAddress.trim()
    ) {
      toast.error("Please fill in all required fields");
      return;
    }
    if (form.password.length < 6) {
      toast.error("Password must be at least 6 characters");
      return;
    }
    if (form.password !== form.confirm) {
      toast.error("Passwords do not match");
      return;
    }

    setLoading(true);

    if (apiEnabled()) {
      try {
        await registerMerchant({
          shopName: form.shopName.trim(),
          ownerName: form.ownerName.trim(),
          email: form.email.trim(),
          phone: form.phone.trim(),
          password: form.password,
          district: form.district,
          businessType: form.businessType.trim(),
          pickupAddress: form.pickupAddress.trim(),
        });
        toast.success("Registration successful — awaiting admin approval.");
        router.push("/login");
      } catch (err) {
        if (err instanceof ApiError) {
          const firstFieldError = Object.values(err.errors)[0]?.[0];
          toast.error(firstFieldError || err.message || "Registration failed");
        } else {
          toast.error(
            `Can't reach the API at ${process.env.NEXT_PUBLIC_API_URL}. Check the server is running.`,
          );
        }
        setLoading(false);
      }
      return;
    }

    setTimeout(() => {
      toast.success("Registration successful — awaiting admin approval.");
      router.push("/login");
    }, 600);
  };

  return (
    <div className="w-full max-w-xl">
      <div className="mb-6 flex flex-col items-center text-center">
        <Link href="/" className="mb-3 flex h-12 w-12 items-center justify-center rounded-xl bg-primary text-white">
          <Truck className="h-6 w-6" />
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight text-brown-800">Become a Merchant</h1>
        <p className="text-sm text-brown-500">
          Create your account — approval usually within 24 hours.
        </p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-brown-100 bg-white p-6 shadow-card"
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input label="Shop name *" name="shopName" value={form.shopName} onChange={(e) => set("shopName", e.target.value)} placeholder="e.g. Karim Traders" />
          <Input label="Owner name *" name="ownerName" value={form.ownerName} onChange={(e) => set("ownerName", e.target.value)} placeholder="Full name" />
          <Input label="Email *" name="email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} placeholder="you@example.com" />
          <Input label="Phone *" name="phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} placeholder="01XXXXXXXXX" />
          <Select
            label="District *"
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
            placeholder="Select district"
            options={BD_DISTRICTS.map((d) => ({ value: d, label: d }))}
          />
          <Input label="Business type" name="businessType" value={form.businessType} onChange={(e) => set("businessType", e.target.value)} placeholder="e.g. Fashion, Electronics" />
          <div className="sm:col-span-2">
            <Input label="Pickup address *" name="pickupAddress" value={form.pickupAddress} onChange={(e) => set("pickupAddress", e.target.value)} placeholder="House, road, area" />
          </div>
          <Input label="Password *" name="password" type="password" value={form.password} onChange={(e) => set("password", e.target.value)} placeholder="At least 6 characters" />
          <Input label="Confirm password *" name="confirm" type="password" value={form.confirm} onChange={(e) => set("confirm", e.target.value)} placeholder="Re-enter password" />
        </div>

        <Button type="submit" loading={loading} className="w-full">
          Create Account
        </Button>

        <p className="text-center text-sm text-brown-500">
          Already have an account?{" "}
          <Link href="/login" className="font-medium text-primary hover:underline">
            Log in
          </Link>
        </p>
      </form>

      <p className="mt-4 text-center text-sm text-brown-500">
        <Link href="/" className="hover:text-primary">← Back to home</Link>
      </p>
    </div>
  );
}
