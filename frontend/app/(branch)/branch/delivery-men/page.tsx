"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { Plus, Upload, Phone, Mail, Check } from "lucide-react";
import Card from "@/components/ui/Card";
import Table, { type Column } from "@/components/ui/Table";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  useDeliveryMen,
  addDeliveryMan,
  setDeliveryManStatus,
  DEFAULT_DELIVERYMAN_PASSWORD,
} from "@/lib/deliveryman-store";
import { useParcels } from "@/lib/parcel-store";
import { useBranchScope } from "@/hooks/useBranchScope";
import { deliveryManCode, cn } from "@/lib/utils";
import type { DeliveryMan } from "@/types";

interface FormState {
  name: string;
  phone: string;
  email: string;
  nid: string;
  passport: string;
  photo: string;
  nidImage: string;
  passportImage: string;
  areas: string[];
}

const emptyForm: FormState = {
  name: "",
  phone: "",
  email: "",
  nid: "",
  passport: "",
  photo: "",
  nidImage: "",
  passportImage: "",
  areas: [],
};

export default function BranchDeliveryMenPage() {
  const toast = useToast();
  const router = useRouter();
  const { branchId, branch } = useBranchScope();
  const people = useDeliveryMen();
  const parcels = useParcels();
  const fileRef = useRef<HTMLInputElement>(null);
  const nidRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState<FormState>(emptyForm);

  const mine = people.filter((d) => d.branchId === branchId);
  const assignedCount = (id: number) =>
    parcels.filter((p) => p.deliveryManId === id).length;

  const hubAreas = branch?.coverageThanas ?? [];
  const areaLabel = (k: string) => k.split("/").slice(1).join("/") || k;

  const set = (key: keyof FormState, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));
  const toggleArea = (k: string) =>
    setForm((f) => ({
      ...f,
      areas: f.areas.includes(k) ? f.areas.filter((x) => x !== k) : [...f.areas, k],
    }));

  const readImage = (key: keyof FormState, file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => set(key, reader.result as string);
    reader.readAsDataURL(file);
  };

  const save = async () => {
    if (branchId == null) return;
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Name, phone and email are required");
      return;
    }
    try {
      await addDeliveryMan({
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        nid: form.nid.trim() || undefined,
        passport: form.passport.trim() || undefined,
        photo: form.photo || undefined,
        nidImage: form.nidImage || undefined,
        passportImage: form.passportImage || undefined,
        branchId,
        areas: form.areas,
      });
      toast.success(
        `${form.name.trim()} added · default password: ${DEFAULT_DELIVERYMAN_PASSWORD}`,
      );
      setForm(emptyForm);
      setOpen(false);
    } catch {
      toast.error("Could not add delivery man (email may already exist).");
    }
  };

  const columns: Column<DeliveryMan>[] = [
    { key: "code", header: "ID", render: (d) => (
      <span className="font-mono text-xs text-brown-600">{deliveryManCode(d.id)}</span>
    ) },
    { key: "name", header: "Name", render: (d) => (
      <div className="flex items-center gap-2">
        <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-primary text-sm font-semibold text-white">
          {d.photo ? (
            <Image src={d.photo} alt={d.name} width={32} height={32} className="h-full w-full object-cover" unoptimized />
          ) : (
            d.name.charAt(0)
          )}
        </span>
        <span className="font-medium text-brown-800">{d.name}</span>
      </div>
    ) },
    { key: "phone", header: "Phone" },
    { key: "nid", header: "NID", render: (d) => d.nid || <span className="text-brown-400">—</span> },
    { key: "assigned", header: "Assigned", render: (d) => (
      <Badge className="bg-brown-100 text-brown-600">{assignedCount(d.id)}</Badge>
    ) },
    { key: "status", header: "Status", render: (d) =>
      d.status === "active" ? (
        <Badge className="bg-primary-100 text-primary-700">Active</Badge>
      ) : (
        <Badge className="bg-brown-100 text-brown-500">Inactive</Badge>
      ) },
    { key: "actions", header: "", className: "text-right", render: (d) => (
      <div className="flex justify-end" onClick={(e) => e.stopPropagation()}>
        <Button
          size="sm"
          variant={d.status === "active" ? "danger" : "outline"}
          onClick={() => setDeliveryManStatus(d.id, d.status === "active" ? "inactive" : "active")}
        >
          {d.status === "active" ? "Deactivate" : "Activate"}
        </Button>
      </div>
    ) },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-brown-500">
          {mine.length} rider(s) at {branch?.name ?? "this hub"}
        </p>
        <Button onClick={() => setOpen(true)}>
          <Plus className="h-4 w-4" /> Add Delivery Man
        </Button>
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={mine}
          rowKey={(d) => d.id}
          onRowClick={(d) => router.push(`/branch/delivery-men/${d.id}`)}
          emptyMessage="No delivery men at this hub yet."
          className="border-0 shadow-none"
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Add Delivery Man"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Add Delivery Man</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Full name"
              value={form.name}
              onChange={(e) => set("name", e.target.value)}
            />
            <Input
              label="Phone"
              value={form.phone}
              onChange={(e) => set("phone", e.target.value)}
              leftIcon={<Phone className="h-4 w-4" />}
              placeholder="01XXXXXXXXX"
            />
            <div className="sm:col-span-2">
              <Input
                label="Email"
                type="email"
                value={form.email}
                onChange={(e) => set("email", e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
              />
            </div>
          </div>

          {/* Delivery areas this rider covers */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-brown-500">
              Delivery areas {hubAreas.length === 0 && "— add areas on the Areas page first"}
            </p>
            {hubAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hubAreas.map((k) => {
                  const on = form.areas.includes(k);
                  return (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleArea(k)}
                      className={cn(
                        "rounded-full border px-2.5 py-1 text-xs font-medium transition-colors",
                        on
                          ? "border-primary bg-primary-50 text-primary-700"
                          : "border-brown-200 bg-white text-brown-500 hover:border-primary-300",
                      )}
                    >
                      {on && <Check className="mr-1 inline h-3 w-3" />}
                      {areaLabel(k)}
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          <div className="rounded-lg border border-dashed border-brown-200 p-3">
            <p className="mb-2 text-xs font-medium text-brown-500">
              Credentials (optional)
            </p>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Input
                label="NID number"
                value={form.nid}
                onChange={(e) => set("nid", e.target.value)}
              />
              <Input
                label="Passport number"
                value={form.passport}
                onChange={(e) => set("passport", e.target.value)}
              />
            </div>
            <div className="mt-3 flex items-center gap-3">
              <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-brown-200 bg-canvas">
                {form.photo ? (
                  <Image src={form.photo} alt="Photo" width={64} height={64} className="h-full w-full object-cover" unoptimized />
                ) : (
                  <Upload className="h-5 w-5 text-brown-400" />
                )}
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => readImage("photo", e.target.files?.[0])}
                />
                <Button type="button" variant="outline" size="sm" onClick={() => fileRef.current?.click()}>
                  <Upload className="h-4 w-4" /> Upload Photo
                </Button>
              </div>
            </div>

            {/* Document uploads */}
            <div className="mt-3 grid grid-cols-2 gap-3">
              {(
                [
                  { label: "NID document", key: "nidImage" as const, ref: nidRef },
                  { label: "Passport document", key: "passportImage" as const, ref: passRef },
                ]
              ).map((doc) => (
                <div key={doc.key}>
                  <input
                    ref={doc.ref}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => readImage(doc.key, e.target.files?.[0])}
                  />
                  <button
                    type="button"
                    onClick={() => doc.ref.current?.click()}
                    className="flex h-20 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-brown-200 bg-canvas text-brown-400 hover:border-primary"
                  >
                    {form[doc.key] ? (
                      <Image src={form[doc.key]} alt={doc.label} width={160} height={90} className="h-full w-full object-cover" unoptimized />
                    ) : (
                      <span className="flex flex-col items-center text-xs">
                        <Upload className="mb-1 h-4 w-4" /> Upload
                      </span>
                    )}
                  </button>
                  <p className="mt-1 text-[11px] text-brown-500">{doc.label}</p>
                </div>
              ))}
            </div>
          </div>

          <p className="rounded-lg bg-warning-50 px-3 py-2 text-xs text-warning-700">
            Assigned to <span className="font-medium">{branch?.name ?? "this hub"}</span>. A
            default login password{" "}
            <span className="font-mono font-semibold">{DEFAULT_DELIVERYMAN_PASSWORD}</span>{" "}
            will be generated for the delivery-man mobile app (coming soon).
          </p>
        </div>
      </Modal>
    </div>
  );
}
