"use client";

import { useState } from "react";
import { Plus, Pencil, MapPin, Trash2 } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import { useZones, addZone, updateZone, deleteZone } from "@/lib/zone-store";
import { formatBDT } from "@/lib/utils";
import type { Zone } from "@/types";

type ZoneForm = {
  name: string;
  districts: string;
  regularCharge: string;
  expressCharge: string;
  codChargePercent: string;
  returnCharge: string;
};

const emptyForm: ZoneForm = {
  name: "",
  districts: "",
  regularCharge: "",
  expressCharge: "",
  codChargePercent: "1",
  returnCharge: "",
};

function toForm(z: Zone): ZoneForm {
  return {
    name: z.name,
    districts: z.districts.join(", "),
    regularCharge: String(z.regularCharge),
    expressCharge: String(z.expressCharge),
    codChargePercent: String(z.codChargePercent),
    returnCharge: String(z.returnCharge),
  };
}

export default function AdminZonesPage() {
  const toast = useToast();
  const zones = useZones();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<ZoneForm>(emptyForm);
  const [deleteTarget, setDeleteTarget] = useState<Zone | null>(null);
  const [deleting, setDeleting] = useState(false);

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (z: Zone) => {
    setEditingId(z.id);
    setForm(toForm(z));
    setOpen(true);
  };

  const setField = (key: keyof ZoneForm, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const save = async () => {
    if (!form.name.trim()) {
      toast.error("Zone name is required");
      return;
    }
    const payload = {
      name: form.name.trim(),
      districts: form.districts
        .split(",")
        .map((d) => d.trim())
        .filter(Boolean),
      regularCharge: Number(form.regularCharge) || 0,
      expressCharge: Number(form.expressCharge) || 0,
      codChargePercent: Number(form.codChargePercent) || 0,
      returnCharge: Number(form.returnCharge) || 0,
    };
    try {
      if (editingId !== null) {
        await updateZone(editingId, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await addZone({ ...payload, isActive: true });
        toast.success(`${payload.name} created`);
      }
      setOpen(false);
    } catch {
      toast.error("Could not save the zone.");
    }
  };

  const remove = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await deleteZone(deleteTarget.id);
      toast.success(`${deleteTarget.name} deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Could not delete the zone.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-brown-500">{zones.length} zones configured</p>
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Zone
        </Button>
      </div>

      {zones.length === 0 && (
        <div className="rounded-xl border border-dashed border-brown-200 bg-white py-12 text-center text-sm text-brown-400">
          No zones configured yet.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {zones.map((z) => (
          <div
            key={z.id}
            className="rounded-xl border border-brown-100 bg-white p-4 shadow-card"
          >
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <MapPin className="h-4 w-4" />
                </span>
                <div>
                  <h3 className="font-semibold text-brown-800">{z.name}</h3>
                  {!z.isActive && <Badge className="bg-brown-100 text-brown-500">Inactive</Badge>}
                </div>
              </div>
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => openEdit(z)}
                  className="rounded-md p-1.5 text-brown-500 hover:bg-brown-50 hover:text-primary"
                  aria-label={`Edit ${z.name}`}
                >
                  <Pencil className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setDeleteTarget(z)}
                  className="rounded-md p-1.5 text-brown-500 hover:bg-danger-50 hover:text-danger-600"
                  aria-label={`Delete ${z.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="mt-3 flex flex-wrap gap-1">
              {z.districts.slice(0, 4).map((d) => (
                <Badge key={d}>{d}</Badge>
              ))}
              {z.districts.length > 4 && (
                <Badge>+{z.districts.length - 4}</Badge>
              )}
            </div>

            <dl className="mt-4 grid grid-cols-2 gap-2 text-sm">
              <div className="rounded-lg bg-canvas px-3 py-2">
                <dt className="text-xs text-brown-500">Regular</dt>
                <dd className="font-medium text-brown-700">{formatBDT(z.regularCharge)}</dd>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <dt className="text-xs text-brown-500">Express</dt>
                <dd className="font-medium text-brown-700">{formatBDT(z.expressCharge)}</dd>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <dt className="text-xs text-brown-500">COD %</dt>
                <dd className="font-medium text-brown-700">{z.codChargePercent}%</dd>
              </div>
              <div className="rounded-lg bg-canvas px-3 py-2">
                <dt className="text-xs text-brown-500">Return</dt>
                <dd className="font-medium text-brown-700">{formatBDT(z.returnCharge)}</dd>
              </div>
            </dl>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId !== null ? "Edit Zone" : "Add Zone"}
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={save}>Save Zone</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Zone name"
            value={form.name}
            onChange={(e) => setField("name", e.target.value)}
            placeholder="e.g. Dhaka City"
          />
          <Input
            label="Districts (comma-separated)"
            value={form.districts}
            onChange={(e) => setField("districts", e.target.value)}
            placeholder="Dhaka, Gazipur"
          />
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Regular charge (৳)"
              type="number"
              value={form.regularCharge}
              onChange={(e) => setField("regularCharge", e.target.value)}
            />
            <Input
              label="Express charge (৳)"
              type="number"
              value={form.expressCharge}
              onChange={(e) => setField("expressCharge", e.target.value)}
            />
            <Input
              label="COD charge (%)"
              type="number"
              value={form.codChargePercent}
              onChange={(e) => setField("codChargePercent", e.target.value)}
            />
            <Input
              label="Return charge (৳)"
              type="number"
              value={form.returnCharge}
              onChange={(e) => setField("returnCharge", e.target.value)}
            />
          </div>
        </div>
      </Modal>

      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Delete zone?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="danger" onClick={remove} disabled={deleting}>
              {deleting ? "Deleting…" : "Delete zone"}
            </Button>
          </>
        }
      >
        <p className="text-sm text-brown-600">
          Delete <span className="font-medium text-brown-800">{deleteTarget?.name}</span>?
          Parcels already booked keep their charges, but new bookings to its
          districts ({deleteTarget?.districts.join(", ") || "—"}) will fall back to
          another zone. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
