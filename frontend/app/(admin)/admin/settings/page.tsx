"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import { Mail, User as UserIcon, Lock, Upload, Building2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Modal from "@/components/ui/Modal";
import AvatarUploader from "@/components/ui/AvatarUploader";
import { useToast } from "@/components/ui/Toast";
import { useAuth } from "@/hooks/useAuth";
import { apiEnabled } from "@/lib/api";
import { changePassword as apiChangePassword } from "@/lib/api/auth";
import { useSiteSettings, saveSiteSettings, saveSiteLogo } from "@/lib/site-settings-store";

const EMPTY_PW = { current: "", next: "", confirm: "" };

export default function AdminSettingsPage() {
  const toast = useToast();
  const { name, email } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState(EMPTY_PW);

  // Company / branding
  const settings = useSiteSettings();
  const logoRef = useRef<HTMLInputElement>(null);
  const [savingBrand, setSavingBrand] = useState(false);
  const [brand, setBrand] = useState({
    companyName: "",
    contactEmail: "",
    contactPhone: "",
    contactAddress: "",
  });
  useEffect(() => {
    setBrand({
      companyName: settings.companyName,
      contactEmail: settings.contactEmail,
      contactPhone: settings.contactPhone,
      contactAddress: settings.contactAddress,
    });
  }, [settings.companyName, settings.contactEmail, settings.contactPhone, settings.contactAddress]);

  const setBrandField = (k: keyof typeof brand, v: string) =>
    setBrand((f) => ({ ...f, [k]: v }));

  const saveBrand = async () => {
    if (!brand.companyName.trim()) {
      toast.error("Company name is required");
      return;
    }
    setSavingBrand(true);
    try {
      await saveSiteSettings({
        companyName: brand.companyName.trim(),
        contactEmail: brand.contactEmail.trim(),
        contactPhone: brand.contactPhone.trim(),
        contactAddress: brand.contactAddress.trim(),
      });
      toast.success("Company settings saved");
    } catch {
      toast.error("Could not save company settings.");
    } finally {
      setSavingBrand(false);
    }
  };

  const onLogo = async (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please choose an image file");
      return;
    }
    try {
      await saveSiteLogo(file);
      toast.success("Logo updated");
    } catch {
      toast.error("Could not upload logo.");
    }
  };

  const changePassword = async () => {
    if (pw.next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (!apiEnabled()) {
      toast.error("Password change requires the API.");
      return;
    }
    try {
      await apiChangePassword(pw.current, pw.next);
      toast.success("Password changed");
      setPw(EMPTY_PW);
      setPwOpen(false);
    } catch {
      toast.error("Current password is incorrect");
    }
  };

  return (
    <div className="max-w-2xl space-y-4">
      <Card
        title={
          <span className="flex items-center gap-2">
            <Building2 className="h-4 w-4" /> Company &amp; Branding
          </span>
        }
      >
        <p className="text-sm text-brown-500">
          Your company name, logo, and contact details show across the site — the
          sidebar, login page, and public landing/footer.
        </p>

        <div className="mt-4 flex items-center gap-4">
          <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl border border-brown-200 bg-canvas">
            {settings.logoUrl ? (
              <Image
                src={settings.logoUrl}
                alt="Logo"
                width={64}
                height={64}
                unoptimized
                className="h-full w-full object-contain"
              />
            ) : (
              <Building2 className="h-6 w-6 text-brown-300" />
            )}
          </div>
          <div>
            <input
              ref={logoRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => onLogo(e.target.files?.[0])}
            />
            <Button variant="outline" size="sm" onClick={() => logoRef.current?.click()}>
              <Upload className="h-4 w-4" /> Upload logo
            </Button>
            <p className="mt-1 text-xs text-brown-400">PNG or JPG, square works best.</p>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <Input
              label="Company name"
              value={brand.companyName}
              onChange={(e) => setBrandField("companyName", e.target.value)}
              placeholder="e.g. HasanEx Courier"
            />
          </div>
          <Input
            label="Contact email"
            type="email"
            value={brand.contactEmail}
            onChange={(e) => setBrandField("contactEmail", e.target.value)}
            placeholder="support@company.com"
          />
          <Input
            label="Contact phone"
            value={brand.contactPhone}
            onChange={(e) => setBrandField("contactPhone", e.target.value)}
            placeholder="09600XXXXXX"
          />
          <div className="sm:col-span-2">
            <Input
              label="Contact address"
              value={brand.contactAddress}
              onChange={(e) => setBrandField("contactAddress", e.target.value)}
              placeholder="House, Road, Area, Dhaka"
            />
          </div>
        </div>
        <div className="mt-4">
          <Button onClick={saveBrand} disabled={savingBrand}>
            {savingBrand ? "Saving…" : "Save company settings"}
          </Button>
        </div>
      </Card>

      <Card title="My Profile Picture">
        <AvatarUploader email={email ?? ""} name={name ?? "Admin"} />
      </Card>

      <Card title="Account">
        <dl className="space-y-3">
          <div className="flex items-center gap-3">
            <UserIcon className="h-4 w-4 text-brown-400" />
            <div>
              <dt className="text-xs text-brown-500">Name</dt>
              <dd className="text-sm font-medium text-brown-800">{name || "—"}</dd>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Mail className="h-4 w-4 text-brown-400" />
            <div>
              <dt className="text-xs text-brown-500">Email</dt>
              <dd className="text-sm font-medium text-brown-800">{email || "—"}</dd>
            </div>
          </div>
        </dl>
        <div className="mt-4 border-t border-brown-100 pt-4">
          <Button variant="outline" onClick={() => setPwOpen(true)}>
            <Lock className="h-4 w-4" /> Change password
          </Button>
        </div>
      </Card>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change password"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword}>Update</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Current password"
            type="password"
            value={pw.current}
            onChange={(e) => setPw((f) => ({ ...f, current: e.target.value }))}
          />
          <Input
            label="New password"
            type="password"
            value={pw.next}
            onChange={(e) => setPw((f) => ({ ...f, next: e.target.value }))}
            placeholder="Min. 6 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={pw.confirm}
            onChange={(e) => setPw((f) => ({ ...f, confirm: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
