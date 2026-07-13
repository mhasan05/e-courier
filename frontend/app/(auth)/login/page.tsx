"use client";

import { useState, type FormEvent } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Mail, Lock } from "lucide-react";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import BrandMark from "@/components/ui/BrandMark";
import { useToast } from "@/components/ui/Toast";
import { useSiteSettings } from "@/lib/site-settings-store";
import { MOCK_CREDENTIALS, DEMO_LOGINS } from "@/lib/constants";
import { authenticateRider } from "@/lib/deliveryman-store";
import { setSession, homeForRole } from "@/lib/auth";
import { apiEnabled, ApiError } from "@/lib/api";
import { login as apiLogin } from "@/lib/api/auth";

// Login. Uses the real Django API when NEXT_PUBLIC_API_URL is set; otherwise
// falls back to the in-memory mock credentials so the demo works standalone.
export default function LoginPage() {
  const router = useRouter();
  const toast = useToast();
  const { companyName } = useSiteSettings();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // --- API path ---
    if (apiEnabled()) {
      try {
        const user = await apiLogin(email.trim(), password);
        setSession({
          token: "jwt",
          role: user.role,
          name: user.name,
          email: user.email,
          branchId: user.branchId ?? null,
          deliveryManId: user.deliveryManId ?? null,
        });
        toast.success(`Welcome back, ${user.name}!`);
        router.replace(homeForRole(user.role));
      } catch (err) {
        if (err instanceof ApiError) {
          setError(
            err.status === 401
              ? "Invalid email/phone or password."
              : `Login failed (${err.status}): ${err.message}`,
          );
        } else {
          // Network/CORS error — fetch threw before reaching the API.
          setError(
            `Can't reach the API at ${process.env.NEXT_PUBLIC_API_URL}. ` +
              "Check the Django server is running and restart `npm run dev` after editing .env.local.",
          );
        }
        setLoading(false);
      }
      return;
    }

    // --- Mock path (no API configured) ---
    setTimeout(() => {
      const id = email.trim();
      const record = MOCK_CREDENTIALS[id.toLowerCase()];
      if (record && record.password === password) {
        setSession({
          token: `mock-${record.role}-token`,
          role: record.role,
          name: record.name,
          email: id.toLowerCase(),
          branchId: record.branchId ?? null,
        });
        toast.success(`Welcome back, ${record.name}!`);
        router.replace(homeForRole(record.role));
        return;
      }

      // Delivery man (rider) — authenticate against the rider store (email/phone).
      const rider = authenticateRider(id, password);
      if (rider) {
        setSession({
          token: "mock-rider-token",
          role: "delivery_man",
          name: rider.name,
          email: rider.email,
          deliveryManId: rider.id,
          branchId: rider.branchId ?? null,
        });
        toast.success(`Welcome back, ${rider.name}!`);
        router.replace("/rider/dashboard");
        return;
      }

      setError("Invalid email/phone or password.");
      setLoading(false);
    }, 500);
  };

  const fillDemo = (demoEmail: string, demoPassword: string) => {
    setEmail(demoEmail);
    setPassword(demoPassword);
    setError("");
  };

  return (
    <div className="w-full max-w-md">
      <div className="mb-6 flex flex-col items-center text-center">
        <BrandMark className="mb-3 h-12 w-12 rounded-2xl shadow-lg shadow-primary-900/25" iconClass="h-6 w-6" />
        <h1 className="text-2xl font-semibold tracking-tight text-brown-900">{companyName}</h1>
        <p className="text-sm text-brown-500">Sign in to your dashboard</p>
      </div>

      <form
        onSubmit={onSubmit}
        className="space-y-4 rounded-2xl border border-brown-100 bg-white p-6 shadow-card"
      >
        <Input
          name="email"
          type="text"
          label="Email or phone"
          placeholder="you@example.com"
          autoComplete="username"
          leftIcon={<Mail className="h-4 w-4" />}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <Input
          name="password"
          type="password"
          label="Password"
          placeholder="••••••••"
          autoComplete="current-password"
          leftIcon={<Lock className="h-4 w-4" />}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={error}
          required
        />

        <Button type="submit" loading={loading} className="w-full">
          Sign In
        </Button>

        <p className="text-center text-sm text-brown-500">
          New merchant?{" "}
          <Link href="/signup" className="font-medium text-primary hover:underline">
            Create an account
          </Link>
        </p>
      </form>

      <div className="mt-4 rounded-xl border border-brown-100 bg-white p-4 text-center text-xs text-brown-500">
        <p className="mb-2 font-medium text-brown-500">Demo accounts — tap to fill</p>
        <div className="flex flex-wrap justify-center gap-2">
          {DEMO_LOGINS.map((d) => (
            <Button
              key={d.email}
              size="sm"
              variant="outline"
              onClick={() => fillDemo(d.email, d.password)}
            >
              {d.label}
            </Button>
          ))}
        </div>
      </div>

      <p className="mt-4 text-center text-sm text-brown-500">
        Are you a customer?{" "}
        <Link href="/track" className="font-medium text-primary hover:underline">
          Track a parcel
        </Link>
      </p>
    </div>
  );
}
