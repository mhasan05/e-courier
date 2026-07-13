"use client";

import { useState, type FormEvent } from "react";
import Card from "@/components/ui/Card";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import StatusBadge from "@/components/ui/StatusBadge";
import AvatarUploader from "@/components/ui/AvatarUploader";
import { useToast } from "@/components/ui/Toast";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { updateMerchant } from "@/lib/merchant-store";
import { SERVICE_DISTRICTS } from "@/lib/constants";

export default function MerchantProfilePage() {
  const toast = useToast();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const [form, setForm] = useState({
    shopName: me.shopName,
    ownerName: me.name,
    email: me.email,
    phone: me.phone,
    pickupAddress: me.address,
    district: me.district,
  });

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    try {
      await updateMerchant(me.id, {
        shopName: form.shopName.trim(),
        name: form.ownerName.trim(),
        phone: form.phone.trim(),
        address: form.pickupAddress.trim(),
        district: form.district,
      });
      toast.success("Profile updated");
    } catch {
      toast.error("Could not update your profile. Please try again.");
    }
  };

  return (
    <form onSubmit={onSubmit} className="max-w-2xl space-y-4">
      <Card title="Profile Picture">
        <AvatarUploader email={me.email} name={me.name} />
      </Card>

      <Card
        title="Shop Profile"
        action={<StatusBadge kind="merchant" status={me.status} />}
      >
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            label="Shop name"
            value={form.shopName}
            onChange={(e) => set("shopName", e.target.value)}
          />
          <Input
            label="Owner name"
            value={form.ownerName}
            onChange={(e) => set("ownerName", e.target.value)}
          />
          <Input
            label="Email (read-only)"
            value={form.email}
            readOnly
            className="cursor-not-allowed bg-canvas text-brown-500"
          />
          <Input
            label="Phone"
            value={form.phone}
            onChange={(e) => set("phone", e.target.value)}
          />
          <div className="sm:col-span-2">
            <Input
              label="Pickup address"
              value={form.pickupAddress}
              onChange={(e) => set("pickupAddress", e.target.value)}
            />
          </div>
          <Select
            label="District"
            value={form.district}
            onChange={(e) => set("district", e.target.value)}
            options={SERVICE_DISTRICTS.map((d) => ({ value: d, label: d }))}
          />
        </div>
      </Card>

      <div className="flex justify-end">
        <Button type="submit">Save Changes</Button>
      </div>
    </form>
  );
}
