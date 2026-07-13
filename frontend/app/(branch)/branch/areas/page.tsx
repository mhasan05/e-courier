"use client";

import { useCallback, useEffect, useState } from "react";
import { MapPin, Plus, Pencil, Trash2 } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import { useToast } from "@/components/ui/Toast";
import { useBranchScope } from "@/hooks/useBranchScope";
import { refreshDeliveryMen } from "@/lib/deliveryman-store";
import { getMyCoverage, setMyCoverage, renameCoverageArea } from "@/lib/api/branches";
import { SERVICE_DISTRICTS } from "@/lib/constants";

const DISTRICT = SERVICE_DISTRICTS[0] || "Dhaka";
const key = (thana: string) => `${DISTRICT}/${thana.trim()}`;
const thanaOf = (k: string) => k.split("/").slice(1).join("/") || k;

export default function BranchAreasPage() {
  const toast = useToast();
  const { branch } = useBranchScope();

  const [coverage, setCoverage] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [newArea, setNewArea] = useState("");
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<{ key: string; value: string } | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(() => {
    getMyCoverage()
      .then((c) => setCoverage(c.coverageThanas || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  const addArea = async () => {
    const name = newArea.trim();
    if (!name) return;
    const k = key(name);
    if (coverage.includes(k)) {
      toast.error("That area already exists.");
      return;
    }
    setBusy(true);
    try {
      const saved = await setMyCoverage([...coverage, k]);
      setCoverage(saved.coverageThanas || []);
      setNewArea("");
      toast.success(`Added ${name}`);
    } catch {
      toast.error("Could not add the area.");
    } finally {
      setBusy(false);
    }
  };

  const saveEdit = async () => {
    if (!editing || !editing.value.trim()) return;
    setBusy(true);
    try {
      const saved = await renameCoverageArea(editing.key, key(editing.value));
      setCoverage(saved.coverageThanas || []);
      refreshDeliveryMen(); // riders assigned to the old name are remapped
      toast.success("Area renamed");
      setEditing(null);
    } catch {
      toast.error("Could not rename (name may already exist).");
    } finally {
      setBusy(false);
    }
  };

  const confirmDelete = async () => {
    if (!deleting) return;
    setBusy(true);
    try {
      const saved = await setMyCoverage(coverage.filter((k) => k !== deleting));
      setCoverage(saved.coverageThanas || []);
      refreshDeliveryMen(); // riders lose the deleted area
      toast.success("Area deleted");
      setDeleting(null);
    } catch {
      toast.error("Could not delete the area.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <p className="p-6 text-sm text-brown-500">Loading…</p>;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-900">Areas &amp; Coverage</h1>
        <p className="text-sm text-brown-500">
          Manage the delivery areas {branch?.name ?? "your hub"} covers. Assign riders
          to areas from each rider&apos;s Add / Edit form.
        </p>
      </div>

      <Card title={<span className="flex items-center gap-2"><MapPin className="h-4 w-4" /> Hub areas ({coverage.length})</span>}>
        <div className="flex gap-2">
          <input
            value={newArea}
            onChange={(e) => setNewArea(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addArea()}
            placeholder={`New area in ${DISTRICT} (e.g. Mirpur 10)`}
            className="h-10 flex-1 rounded-lg border border-brown-200 bg-white px-3 text-sm text-brown-800 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary-200"
          />
          <Button onClick={addArea} disabled={busy || !newArea.trim()}>
            <Plus className="h-4 w-4" /> Add
          </Button>
        </div>

        {coverage.length === 0 ? (
          <p className="mt-4 text-sm text-brown-400">
            No areas yet. Add the areas this hub delivers to.
          </p>
        ) : (
          <ul className="mt-4 divide-y divide-brown-100 rounded-lg border border-brown-100">
            {coverage.map((k) => (
              <li key={k} className="flex items-center justify-between px-3 py-2.5">
                <span className="flex items-center gap-2 text-sm text-brown-800">
                  <MapPin className="h-4 w-4 text-brown-400" /> {thanaOf(k)}
                </span>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditing({ key: k, value: thanaOf(k) })}
                    className="rounded-md p-1.5 text-brown-500 hover:bg-brown-50 hover:text-primary"
                    aria-label={`Edit ${thanaOf(k)}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => setDeleting(k)}
                    className="rounded-md p-1.5 text-brown-500 hover:bg-danger-50 hover:text-danger-600"
                    aria-label={`Delete ${thanaOf(k)}`}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>

      {/* Edit (rename) modal */}
      <Modal
        open={editing != null}
        onClose={() => setEditing(null)}
        title="Rename area"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setEditing(null)}>Cancel</Button>
            <Button onClick={saveEdit} disabled={busy}>Save</Button>
          </>
        }
      >
        <Input
          label="Area name"
          value={editing?.value ?? ""}
          onChange={(e) => setEditing((s) => (s ? { ...s, value: e.target.value } : s))}
        />
        <p className="mt-2 text-xs text-brown-500">
          Riders assigned to this area will be updated automatically.
        </p>
      </Modal>

      {/* Delete confirm */}
      <Modal
        open={deleting != null}
        onClose={() => setDeleting(null)}
        title="Delete area?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setDeleting(null)}>Cancel</Button>
            <Button variant="danger" onClick={confirmDelete} disabled={busy}>Delete</Button>
          </>
        }
      >
        <p className="text-sm text-brown-600">
          Remove <span className="font-medium text-brown-800">{deleting ? thanaOf(deleting) : ""}</span> from
          your hub? It will be unassigned from any riders that cover it, and new
          bookings to this area will fall back to another hub.
        </p>
      </Modal>
    </div>
  );
}
