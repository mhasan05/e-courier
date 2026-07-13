"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Pencil, Building2, MapPin, Network, AlertTriangle, UserCog } from "lucide-react";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import StatCard from "@/components/ui/StatCard";
import BranchCoverageEditor from "@/components/branches/BranchCoverageEditor";
import { useToast } from "@/components/ui/Toast";
import {
  useBranches,
  addBranch,
  updateBranch,
  toggleBranchActive,
} from "@/lib/branch-store";
import { SERVICE_DISTRICTS } from "@/lib/constants";
import { upazilasFor } from "@/lib/geo";
import upazilas from "@/lib/mock-data/upazilas.json";
import { apiEnabled } from "@/lib/api";
import {
  listManagers,
  createManager,
  updateManager,
  type HubManager,
} from "@/lib/api/accounts";
import type { Branch, BranchType } from "@/types";

const TOTAL_THANAS = Object.values(upazilas as Record<string, string[]>).reduce(
  (s, t) => s + t.length,
  0,
);

interface BranchForm {
  name: string;
  code: string;
  type: BranchType;
  phone: string;
  address: string;
  district: string;
  thana: string;
  coverageThanas: string[];
}

const emptyForm: BranchForm = {
  name: "",
  code: "",
  type: "hub",
  phone: "",
  address: "",
  district: "",
  thana: "",
  coverageThanas: [],
};

export default function AdminBranchesPage() {
  const toast = useToast();
  const branches = useBranches();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [form, setForm] = useState<BranchForm>(emptyForm);

  const set = <K extends keyof BranchForm>(key: K, value: BranchForm[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  // ── Hub managers (assign one per hub) ────────────────────────────────────
  const [managers, setManagers] = useState<HubManager[]>([]);
  const loadManagers = () => {
    if (!apiEnabled()) return;
    listManagers(200)
      .then((r) => setManagers(r.results ?? []))
      .catch(() => {});
  };
  useEffect(loadManagers, []);
  const managerByBranch = useMemo(
    () =>
      new Map(
        managers
          .filter((m) => m.branchId != null)
          .map((m) => [m.branchId as number, m]),
      ),
    [managers],
  );

  const [assignHub, setAssignHub] = useState<Branch | null>(null);
  const [pickedManager, setPickedManager] = useState("");
  const [newMgr, setNewMgr] = useState({ name: "", email: "", password: "" });

  const openAssign = (b: Branch) => {
    setAssignHub(b);
    setPickedManager("");
    setNewMgr({ name: "", email: "", password: "" });
  };

  const saveAssign = async () => {
    if (!assignHub) return;
    try {
      if (pickedManager) {
        await updateManager(Number(pickedManager), { branchId: assignHub.id });
      } else if (
        newMgr.name.trim() &&
        newMgr.email.trim() &&
        newMgr.password.length >= 6
      ) {
        await createManager({
          name: newMgr.name.trim(),
          email: newMgr.email.trim(),
          password: newMgr.password,
          branchId: assignHub.id,
        });
      } else {
        toast.error("Pick a manager, or fill the new-manager form (password ≥ 6 chars).");
        return;
      }
      toast.success(`Manager assigned to ${assignHub.name}`);
      setAssignHub(null);
      loadManagers();
    } catch {
      toast.error("Could not assign manager (email may already be in use).");
    }
  };

  // Coverage stats across active hubs.
  const covered = useMemo(() => {
    const s = new Set<string>();
    branches
      .filter((b) => b.isActive)
      .forEach((b) => b.coverageThanas.forEach((t) => s.add(t)));
    return s.size;
  }, [branches]);
  const gaps = TOTAL_THANAS - covered;
  const centralCount = branches.filter((b) => b.type === "central").length;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };
  const openEdit = (b: Branch) => {
    setEditingId(b.id);
    setForm({
      name: b.name,
      code: b.code,
      type: b.type,
      phone: b.phone,
      address: b.address,
      district: b.district,
      thana: b.thana,
      coverageThanas: b.coverageThanas,
    });
    setOpen(true);
  };

  const save = async () => {
    if (!form.name.trim() || !form.code.trim()) {
      toast.error("Name and code are required");
      return;
    }
    if (form.type === "central" && centralCount >= 1) {
      const current = branches.find((b) => b.type === "central");
      if (current && current.id !== editingId) {
        toast.error(`${current.name} is already the central hub`);
        return;
      }
    }
    const payload = {
      name: form.name.trim(),
      code: form.code.trim().toUpperCase(),
      type: form.type,
      phone: form.phone.trim(),
      address: form.address.trim(),
      district: form.district,
      thana: form.thana,
      coverageThanas: form.coverageThanas,
      managerUserId: null,
      isActive: true,
    };
    try {
      if (editingId !== null) {
        await updateBranch(editingId, payload);
        toast.success(`${payload.name} updated`);
      } else {
        await addBranch(payload);
        toast.success(`${payload.name} added`);
      }
      setOpen(false);
    } catch {
      toast.error("Could not save the hub. Please try again.");
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <StatCard label="Hubs" value={branches.length} icon={Building2} accent="brown" />
        <StatCard label="Central Hub" value={centralCount} icon={Network} />
        <StatCard label="Thanas Covered" value={`${covered}/${TOTAL_THANAS}`} icon={MapPin} accent="amber" />
        <StatCard label="Coverage Gaps" value={gaps} icon={AlertTriangle} accent={gaps > 0 ? "amber" : "brown"} />
      </div>

      {gaps > 0 && (
        <div className="flex items-center gap-2 rounded-lg border border-warning-200 bg-warning-50 px-4 py-2.5 text-sm text-warning-700">
          <AlertTriangle className="h-4 w-4" />
          {gaps} thana(s) are not covered by any active hub — parcels there fall back to the central hub.
        </div>
      )}

      <div className="flex justify-end">
        <Button onClick={openCreate}>
          <Plus className="h-4 w-4" /> Add Hub
        </Button>
      </div>

      {branches.length === 0 && (
        <div className="rounded-xl border border-dashed border-brown-200 bg-white py-12 text-center text-sm text-brown-400">
          No hubs yet — add your first hub to get started.
        </div>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {branches.map((b) => (
          <div key={b.id} className="rounded-xl border border-brown-100 bg-white p-4 shadow-card">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-2">
                <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary-50 text-primary">
                  <Building2 className="h-4 w-4" />
                </span>
                <div>
                  <p className="font-semibold text-brown-800">{b.name}</p>
                  <p className="font-mono text-xs text-brown-500">{b.code}</p>
                </div>
              </div>
              <button
                onClick={() => openEdit(b)}
                className="rounded-md p-1.5 text-brown-500 hover:bg-brown-50 hover:text-primary"
                aria-label={`Edit ${b.name}`}
              >
                <Pencil className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-2 flex flex-wrap gap-1">
              {b.type === "central" && (
                <Badge className="bg-primary-100 text-primary-700">Central</Badge>
              )}
              {!b.isActive && (
                <Badge className="bg-brown-100 text-brown-500">Inactive</Badge>
              )}
            </div>

            <p className="mt-2 text-xs text-brown-500">{b.address}</p>
            <p className="text-xs text-brown-500">{b.phone}</p>

            <div className="mt-2 flex items-center gap-1.5 border-t border-brown-100 pt-2 text-xs">
              <UserCog className="h-3.5 w-3.5 text-brown-400" />
              {managerByBranch.get(b.id) ? (
                <span className="font-medium text-brown-700">
                  {managerByBranch.get(b.id)!.name}
                </span>
              ) : (
                <span className="text-brown-400">No manager assigned</span>
              )}
              {apiEnabled() && (
                <button
                  onClick={() => openAssign(b)}
                  className="ml-auto font-medium text-primary hover:underline"
                >
                  {managerByBranch.get(b.id) ? "Change" : "Assign"}
                </button>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between border-t border-brown-100 pt-3">
              <span className="text-sm text-brown-600">
                <span className="font-semibold text-brown-800">{b.coverageThanas.length}</span> thanas
              </span>
              <Button
                size="sm"
                variant={b.isActive ? "danger" : "outline"}
                onClick={() => toggleBranchActive(b.id)}
              >
                {b.isActive ? "Disable" : "Enable"}
              </Button>
            </div>
          </div>
        ))}
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title={editingId !== null ? "Edit Hub" : "Add Hub"}
        size="lg"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={save}>Save Hub</Button>
          </>
        }
      >
        <div className="space-y-3">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input label="Hub name" value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="e.g. Dhaka Central Hub" />
            <Input label="Code" value={form.code} onChange={(e) => set("code", e.target.value)} placeholder="e.g. DHK-01" />
            <Select
              label="Type"
              value={form.type}
              onChange={(e) => set("type", e.target.value as BranchType)}
              options={[
                { value: "hub", label: "Hub" },
                { value: "central", label: "Central Hub" },
              ]}
            />
            <Input label="Phone" value={form.phone} onChange={(e) => set("phone", e.target.value)} />
            <Select
              label="District"
              value={form.district}
              onChange={(e) => setForm((f) => ({ ...f, district: e.target.value, thana: "" }))}
              placeholder="Select district"
              options={SERVICE_DISTRICTS.map((d) => ({ value: d, label: d }))}
            />
            <Select
              label="Thana"
              value={form.thana}
              onChange={(e) => set("thana", e.target.value)}
              placeholder={form.district ? "Select thana" : "Select district first"}
              disabled={!form.district}
              options={(form.district ? upazilasFor(form.district) : []).map((t) => ({ value: t, label: t }))}
            />
            <div className="sm:col-span-2">
              <Input label="Address" value={form.address} onChange={(e) => set("address", e.target.value)} />
            </div>
          </div>

          <div>
            <div className="mb-1.5 flex items-center justify-between">
              <span className="text-sm font-medium text-brown-700">Delivery Coverage</span>
              <span className="text-xs text-brown-500">
                {form.coverageThanas.length} thana(s) selected
              </span>
            </div>
            <BranchCoverageEditor
              value={form.coverageThanas}
              onChange={(next) => set("coverageThanas", next)}
            />
            <p className="mt-1.5 text-xs text-brown-500">
              Thanas assigned here are removed from any other hub (one hub per thana).
            </p>
          </div>
        </div>
      </Modal>

      {/* Assign / change hub manager */}
      <Modal
        open={assignHub != null}
        onClose={() => setAssignHub(null)}
        title={`Assign manager — ${assignHub?.name ?? ""}`}
        footer={
          <>
            <Button variant="ghost" onClick={() => setAssignHub(null)}>Cancel</Button>
            <Button onClick={saveAssign}>Save</Button>
          </>
        }
      >
        <div className="space-y-4">
          <Select
            label="Assign an existing manager"
            value={pickedManager}
            onChange={(e) => setPickedManager(e.target.value)}
            placeholder="Select a manager…"
            options={managers.map((m) => ({
              value: String(m.id),
              label: `${m.name}${m.branchName ? ` (now: ${m.branchName})` : " (unassigned)"}`,
            }))}
          />
          <div className="flex items-center gap-3 text-xs text-brown-400">
            <span className="h-px flex-1 bg-brown-100" /> or create a new manager{" "}
            <span className="h-px flex-1 bg-brown-100" />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <Input
              label="Name"
              value={newMgr.name}
              onChange={(e) => setNewMgr((f) => ({ ...f, name: e.target.value }))}
              disabled={!!pickedManager}
            />
            <Input
              label="Email"
              type="email"
              value={newMgr.email}
              onChange={(e) => setNewMgr((f) => ({ ...f, email: e.target.value }))}
              disabled={!!pickedManager}
            />
            <div className="sm:col-span-2">
              <Input
                label="Password"
                type="password"
                value={newMgr.password}
                onChange={(e) => setNewMgr((f) => ({ ...f, password: e.target.value }))}
                disabled={!!pickedManager}
                placeholder="Min. 6 characters"
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}
