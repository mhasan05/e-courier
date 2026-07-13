"use client";

import { useRef, useState, type RefObject } from "react";
import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Phone,
  Mail,
  IdCard,
  Building2,
  Calendar,
  Pencil,
  Check,
  Ban,
  Upload,
  FileText,
  KeyRound,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import StatusBadge from "@/components/ui/StatusBadge";
import Table, { type Column } from "@/components/ui/Table";
import PanelLoading from "@/components/layout/PanelLoading";
import { useToast } from "@/components/ui/Toast";
import { useHydrated } from "@/hooks/useHydrated";
import {
  useDeliveryMen,
  useDeliveryMenReady,
  updateDeliveryMan,
  setDeliveryManStatus,
  resetRiderPassword,
} from "@/lib/deliveryman-store";
import { useParcels } from "@/lib/parcel-store";
import { useBranches, getBranchById } from "@/lib/branch-store";
import { formatBDT, formatDate, deliveryManCode, cn } from "@/lib/utils";
import type { Parcel } from "@/types";

// Shared delivery-man detail + edit view. Used by the admin panel and by the
// hub-manager (branch) panel. The backend scopes writes to the caller's hub, so
// a hub manager can only open/edit riders in their own hub. Hub reassignment is
// admin-only (a hub manager must not move a rider out of their own hub).
export default function DeliveryManDetail({
  id,
  basePath,
  allowHubReassign,
}: {
  id: number;
  basePath: string; // "/admin" or "/branch"
  allowHubReassign: boolean;
}) {
  const toast = useToast();
  const hydrated = useHydrated();
  const ready = useDeliveryMenReady();
  const people = useDeliveryMen();
  const allParcels = useParcels();
  const branches = useBranches();
  const dm = people.find((d) => d.id === id);

  const photoRef = useRef<HTMLInputElement>(null);
  const nidRef = useRef<HTMLInputElement>(null);
  const passRef = useRef<HTMLInputElement>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [confirmToggle, setConfirmToggle] = useState(false);
  const [viewDoc, setViewDoc] = useState<{ label: string; url: string } | null>(null);
  const [pwOpen, setPwOpen] = useState(false);
  const [newPw, setNewPw] = useState("");
  const [savingPw, setSavingPw] = useState(false);
  const [form, setForm] = useState({
    name: "",
    phone: "",
    email: "",
    nid: "",
    passport: "",
    photo: "",
    nidImage: "",
    passportImage: "",
    branchId: "",
  });
  const [editAreas, setEditAreas] = useState<string[]>([]);

  if (!hydrated || !ready) return <PanelLoading />;
  if (!dm) notFound();

  const assigned = allParcels.filter((p) => p.deliveryManId === dm.id);
  const hub = getBranchById(dm.branchId);
  const hubAreas = hub?.coverageThanas ?? [];
  const areaLabel = (k: string) => k.split("/").slice(1).join("/") || k;
  const toggleArea = (k: string) =>
    setEditAreas((a) => (a.includes(k) ? a.filter((x) => x !== k) : [...a, k]));

  const openEdit = () => {
    setForm({
      name: dm.name,
      phone: dm.phone,
      email: dm.email,
      nid: dm.nid ?? "",
      passport: dm.passport ?? "",
      photo: dm.photo ?? "",
      nidImage: dm.nidImage ?? "",
      passportImage: dm.passportImage ?? "",
      branchId: dm.branchId ? String(dm.branchId) : "",
    });
    setEditAreas(dm.areas ?? []);
    setEditOpen(true);
  };

  const set = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const readImage = (key: keyof typeof form, file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please upload an image file");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => set(key, reader.result as string);
    reader.readAsDataURL(file);
  };

  const saveEdit = async () => {
    if (!form.name.trim() || !form.phone.trim() || !form.email.trim()) {
      toast.error("Name, phone and email are required");
      return;
    }
    try {
      await updateDeliveryMan(dm.id, {
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim(),
        nid: form.nid.trim() || undefined,
        passport: form.passport.trim() || undefined,
        photo: form.photo || undefined,
        nidImage: form.nidImage || undefined,
        passportImage: form.passportImage || undefined,
        // Hub reassignment is admin-only.
        branchId: allowHubReassign && form.branchId ? Number(form.branchId) : undefined,
        areas: editAreas,
      });
      toast.success("Delivery man updated");
      setEditOpen(false);
    } catch {
      toast.error("Could not update delivery man.");
    }
  };

  const documents = [
    { label: "Profile Photo", image: dm.photo, note: undefined as string | undefined },
    { label: "National ID (NID)", image: dm.nidImage, note: dm.nid },
    { label: "Passport", image: dm.passportImage, note: dm.passport },
  ];

  const toggleStatus = () => {
    const next = dm.status === "active" ? "inactive" : "active";
    setDeliveryManStatus(dm.id, next);
    toast.success(next === "active" ? `${dm.name} activated` : `${dm.name} deactivated`);
    setConfirmToggle(false);
  };

  const savePassword = async () => {
    if (newPw.trim().length < 6) {
      toast.error("Password must be at least 6 characters.");
      return;
    }
    setSavingPw(true);
    try {
      await resetRiderPassword(dm.id, newPw.trim());
      toast.success(`Password reset — share it with ${dm.name}`);
      setPwOpen(false);
      setNewPw("");
    } catch {
      toast.error("Could not reset the password.");
    } finally {
      setSavingPw(false);
    }
  };

  const infoRows = [
    { icon: Phone, label: "Phone", value: dm.phone },
    { icon: Mail, label: "Email", value: dm.email },
    { icon: IdCard, label: "NID", value: dm.nid || "—" },
    { icon: IdCard, label: "Passport", value: dm.passport || "—" },
    { icon: Building2, label: "Hub", value: hub ? `${hub.name} (${hub.code})` : "Unassigned" },
    { icon: Calendar, label: "Joined", value: formatDate(dm.createdAt) },
  ];

  const columns: Column<Parcel>[] = [
    {
      key: "trackingId",
      header: "Tracking ID",
      render: (p) => (
        <Link href={`${basePath}/parcels/${p.id}`} className="font-mono text-xs text-primary hover:underline">
          {p.trackingId}
        </Link>
      ),
    },
    { key: "recipientName", header: "Recipient" },
    { key: "district", header: "District" },
    { key: "codAmount", header: "COD", render: (p) => formatBDT(p.codAmount) },
    { key: "status", header: "Status", render: (p) => <StatusBadge kind="parcel" status={p.status} /> },
  ];

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Link
          href={`${basePath}/delivery-men`}
          className="inline-flex items-center gap-1 text-sm text-brown-500 hover:text-primary"
        >
          <ArrowLeft className="h-4 w-4" /> Back to delivery men
        </Link>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={openEdit}>
            <Pencil className="h-4 w-4" /> Edit Details
          </Button>
          <Button variant="outline" size="sm" onClick={() => { setNewPw(""); setPwOpen(true); }}>
            <KeyRound className="h-4 w-4" /> Reset Password
          </Button>
          {dm.status === "active" ? (
            <Button variant="danger" size="sm" onClick={() => setConfirmToggle(true)}>
              <Ban className="h-4 w-4" /> Deactivate
            </Button>
          ) : (
            <Button size="sm" onClick={() => setConfirmToggle(true)}>
              <Check className="h-4 w-4" /> Activate
            </Button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {/* Profile */}
        <Card className="lg:col-span-2">
          <div className="flex items-start gap-4">
            <span className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-xl bg-primary text-2xl font-semibold text-white">
              {dm.photo ? (
                <Image src={dm.photo} alt={dm.name} width={64} height={64} className="h-full w-full object-cover" unoptimized />
              ) : (
                dm.name.charAt(0)
              )}
            </span>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold text-brown-800">{dm.name}</h2>
                {dm.status === "active" ? (
                  <Badge className="bg-primary-100 text-primary-700">Active</Badge>
                ) : (
                  <Badge className="bg-brown-100 text-brown-500">Inactive</Badge>
                )}
              </div>
              <span className="mt-1 inline-block rounded-md bg-primary-50 px-2 py-0.5 font-mono text-xs font-medium text-primary-700">
                {deliveryManCode(dm.id)}
              </span>
            </div>
          </div>

          <dl className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            {infoRows.map((row) => {
              const Icon = row.icon;
              return (
                <div key={row.label} className="flex items-start gap-2">
                  <Icon className="mt-0.5 h-4 w-4 text-brown-400" />
                  <div>
                    <dt className="text-xs text-brown-500">{row.label}</dt>
                    <dd className="text-sm text-brown-700">{row.value}</dd>
                  </div>
                </div>
              );
            })}
          </dl>

          <div className="mt-4 border-t border-brown-100 pt-3">
            <p className="mb-1.5 text-xs text-brown-500">Delivery areas</p>
            {dm.areas && dm.areas.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {dm.areas.map((k) => (
                  <span key={k} className="rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium text-primary-700">
                    {areaLabel(k)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-brown-400">None assigned</p>
            )}
          </div>
        </Card>

        {/* Assignment summary */}
        <Card title="Delivery Summary">
          <div className="space-y-3">
            <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2.5">
              <span className="text-sm text-brown-500">Assigned Parcels</span>
              <span className="text-base font-semibold text-brown-800">{assigned.length}</span>
            </div>
            <div className="flex items-center justify-between rounded-lg bg-canvas px-3 py-2.5">
              <span className="text-sm text-brown-500">Delivered</span>
              <span className="text-base font-semibold text-primary">
                {assigned.filter((p) => p.status === "delivered").length}
              </span>
            </div>
            <a
              href={`tel:${dm.phone}`}
              className="flex items-center justify-center gap-2 rounded-lg bg-primary px-3 py-2.5 text-sm font-medium text-white hover:bg-primary-700"
            >
              <Phone className="h-4 w-4" /> Call {dm.phone}
            </a>
          </div>
        </Card>
      </div>

      {/* Documents provided */}
      <Card title="Documents">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {documents.map((doc) => (
            <div key={doc.label} className="rounded-xl border border-brown-100 p-3">
              <p className="mb-2 text-sm font-medium text-brown-700">{doc.label}</p>
              {doc.image ? (
                <button
                  type="button"
                  onClick={() => setViewDoc({ label: doc.label, url: doc.image! })}
                  className="block w-full overflow-hidden rounded-lg border border-brown-100"
                  title="Click to view"
                >
                  <Image
                    src={doc.image}
                    alt={doc.label}
                    width={320}
                    height={180}
                    className="h-32 w-full object-cover transition-opacity hover:opacity-90"
                    unoptimized
                  />
                </button>
              ) : (
                <div className="flex h-32 flex-col items-center justify-center rounded-lg border border-dashed border-brown-200 bg-canvas text-center text-xs text-brown-400">
                  <FileText className="mb-1 h-5 w-5" />
                  Not provided
                </div>
              )}
              {doc.note && (
                <p className="mt-2 text-xs text-brown-500">
                  No: <span className="font-mono text-brown-700">{doc.note}</span>
                </p>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card title={`Assigned Parcels (${assigned.length})`} bodyClassName="p-0">
        <Table
          columns={columns}
          data={assigned}
          rowKey={(p) => p.id}
          emptyMessage="No parcels assigned to this delivery man."
          className="border-0 shadow-none"
        />
      </Card>

      {/* Status confirm */}
      <Modal
        open={confirmToggle}
        onClose={() => setConfirmToggle(false)}
        title={dm.status === "active" ? "Deactivate delivery man?" : "Activate delivery man?"}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setConfirmToggle(false)}>Cancel</Button>
            <Button variant={dm.status === "active" ? "danger" : "primary"} onClick={toggleStatus}>
              {dm.status === "active" ? "Deactivate" : "Activate"}
            </Button>
          </>
        }
      >
        <div className="space-y-2 text-sm text-brown-600">
          <div className="flex items-center gap-2">
            <span className="text-brown-500">Current status:</span>
            {dm.status === "active" ? (
              <Badge className="bg-primary-100 text-primary-700">Active</Badge>
            ) : (
              <Badge className="bg-brown-100 text-brown-500">Inactive</Badge>
            )}
          </div>
          <p>
            {dm.status === "active"
              ? `${dm.name} will no longer appear in assignment lists.`
              : `${dm.name} will be available for parcel assignment again.`}
          </p>
        </div>
      </Modal>

      {/* Edit modal */}
      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit Delivery Man"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditOpen(false)}>Cancel</Button>
            <Button onClick={saveEdit}>Save Changes</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="flex items-center gap-3">
            <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-lg border border-dashed border-brown-200 bg-canvas">
              {form.photo ? (
                <Image src={form.photo} alt="Photo" width={64} height={64} className="h-full w-full object-cover" unoptimized />
              ) : (
                <Upload className="h-5 w-5 text-brown-400" />
              )}
            </div>
            <div>
              <input ref={photoRef} type="file" accept="image/*" className="hidden" onChange={(e) => readImage("photo", e.target.files?.[0])} />
              <Button type="button" variant="outline" size="sm" onClick={() => photoRef.current?.click()}>
                <Upload className="h-4 w-4" /> Upload Photo
              </Button>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Full name" value={form.name} onChange={(e) => set("name", e.target.value)} />
            <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <Input label="Email" type="email" value={form.email} onChange={(e) => set("email", e.target.value)} />
            {allowHubReassign && (
              <Select
                label="Hub"
                value={form.branchId}
                onChange={(e) => set("branchId", e.target.value)}
                placeholder="Assign a hub"
                options={branches.map((b) => ({ value: String(b.id), label: `${b.name} (${b.code})` }))}
              />
            )}
            <Input label="NID number" value={form.nid} onChange={(e) => set("nid", e.target.value)} />
            <Input label="Passport number" value={form.passport} onChange={(e) => set("passport", e.target.value)} />
          </div>

          {/* Delivery areas covered */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-brown-500">
              Delivery areas{hubAreas.length === 0 ? " — none set for this hub yet" : ""}
            </p>
            {hubAreas.length > 0 && (
              <div className="flex flex-wrap gap-1.5">
                {hubAreas.map((k) => {
                  const on = editAreas.includes(k);
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

          {/* Document uploads */}
          <div className="rounded-lg border border-dashed border-brown-200 p-3">
            <p className="mb-2 text-xs font-medium text-brown-500">Documents (optional)</p>
            <div className="grid grid-cols-2 gap-3">
              <DocField
                label="NID document"
                image={form.nidImage}
                onPick={(f) => readImage("nidImage", f)}
                inputRef={nidRef}
              />
              <DocField
                label="Passport document"
                image={form.passportImage}
                onPick={(f) => readImage("passportImage", f)}
                inputRef={passRef}
              />
            </div>
          </div>
        </div>
      </Modal>

      {/* Reset password */}
      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Reset login password"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={savePassword} disabled={savingPw}>
              {savingPw ? "Saving…" : "Set password"}
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <p className="text-sm text-brown-600">
            Set a new login password for{" "}
            <span className="font-medium text-brown-800">{dm.name}</span> ({dm.email}).
            Share it with them — they can change it later from their profile.
          </p>
          <Input
            label="New password"
            type="text"
            value={newPw}
            onChange={(e) => setNewPw(e.target.value)}
            placeholder="At least 6 characters"
          />
        </div>
      </Modal>

      {/* Document viewer */}
      <Modal
        open={!!viewDoc}
        onClose={() => setViewDoc(null)}
        title={viewDoc?.label}
        size="lg"
      >
        {viewDoc && (
          <Image
            src={viewDoc.url}
            alt={viewDoc.label}
            width={1000}
            height={700}
            className="h-auto w-full rounded-lg"
            unoptimized
          />
        )}
      </Modal>
    </div>
  );
}

function DocField({
  label,
  image,
  onPick,
  inputRef,
}: {
  label: string;
  image?: string;
  onPick: (file?: File) => void;
  inputRef: RefObject<HTMLInputElement>;
}) {
  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => onPick(e.target.files?.[0])}
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="flex h-24 w-full items-center justify-center overflow-hidden rounded-lg border border-dashed border-brown-200 bg-canvas text-brown-400 hover:border-primary"
      >
        {image ? (
          <Image src={image} alt={label} width={200} height={120} className="h-full w-full object-cover" unoptimized />
        ) : (
          <span className="flex flex-col items-center text-xs">
            <Upload className="mb-1 h-4 w-4" /> Upload
          </span>
        )}
      </button>
      <p className="mt-1 text-[11px] text-brown-500">{label}</p>
    </div>
  );
}
