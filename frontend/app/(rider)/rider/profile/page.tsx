"use client";

import { useState } from "react";
import Image from "next/image";
import { Phone, Mail, Building2, BadgeCheck, IdCard, LogOut, Lock } from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import PanelLoading from "@/components/layout/PanelLoading";
import { useToast } from "@/components/ui/Toast";
import { useRiderScope } from "@/hooks/useRiderScope";
import { useAuth } from "@/hooks/useAuth";
import { getBranchById } from "@/lib/branch-store";
import {
  setRiderPassword,
  verifyRiderPassword,
  riderUsesDefaultPassword,
} from "@/lib/deliveryman-store";
import { apiEnabled } from "@/lib/api";
import { changePassword as apiChangePassword } from "@/lib/api/auth";
import { formatDate } from "@/lib/utils";

const EMPTY_PW = { current: "", next: "", confirm: "" };

export default function RiderProfilePage() {
  const toast = useToast();
  const { rider, loading } = useRiderScope();
  const { logout } = useAuth();
  const [pwOpen, setPwOpen] = useState(false);
  const [pw, setPw] = useState(EMPTY_PW);

  if (loading) return <PanelLoading />;
  if (!rider) {
    return <p className="text-sm text-brown-500">No rider account.</p>;
  }

  const usingDefault = riderUsesDefaultPassword(rider.id);

  const changePassword = async () => {
    if (pw.next.length < 6) {
      toast.error("New password must be at least 6 characters");
      return;
    }
    if (pw.next !== pw.confirm) {
      toast.error("Passwords do not match");
      return;
    }
    if (apiEnabled()) {
      try {
        await apiChangePassword(pw.current, pw.next);
        toast.success("Password changed");
        setPw(EMPTY_PW);
        setPwOpen(false);
      } catch {
        toast.error("Current password is incorrect");
      }
      return;
    }
    if (!verifyRiderPassword(rider.id, pw.current)) {
      toast.error("Current password is incorrect");
      return;
    }
    setRiderPassword(rider.id, pw.next);
    toast.success("Password changed");
    setPw(EMPTY_PW);
    setPwOpen(false);
  };

  const hub = getBranchById(rider.branchId);

  const rows = [
    { icon: Phone, label: "Phone", value: rider.phone },
    { icon: Mail, label: "Email", value: rider.email },
    { icon: Building2, label: "Hub", value: hub ? `${hub.name} (${hub.code})` : "—" },
    { icon: IdCard, label: "NID", value: rider.nid || "—" },
    { icon: BadgeCheck, label: "Joined", value: formatDate(rider.createdAt) },
  ];

  return (
    <div className="space-y-4">
      <Card>
        <div className="flex flex-col items-center text-center">
          {rider.photo ? (
            <Image
              src={rider.photo}
              alt={rider.name}
              width={80}
              height={80}
              className="h-20 w-20 rounded-full object-cover ring-2 ring-primary-100"
            />
          ) : (
            <span className="flex h-20 w-20 items-center justify-center rounded-full bg-primary-50 text-2xl font-semibold tracking-tight text-primary">
              {rider.name.charAt(0)}
            </span>
          )}
          <p className="mt-3 text-lg font-semibold text-brown-800">{rider.name}</p>
          <span className="mt-1 inline-flex items-center gap-1 rounded-full bg-primary-50 px-2.5 py-0.5 text-xs font-medium capitalize text-primary-700">
            <BadgeCheck className="h-3.5 w-3.5" /> {rider.status}
          </span>
        </div>
      </Card>

      <Card title="Details">
        <dl className="divide-y divide-brown-50">
          {rows.map((r) => {
            const Icon = r.icon;
            return (
              <div key={r.label} className="flex items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                <Icon className="h-4 w-4 shrink-0 text-brown-400" />
                <dt className="w-16 shrink-0 text-xs text-brown-500">{r.label}</dt>
                <dd className="min-w-0 flex-1 truncate text-sm text-brown-700">{r.value}</dd>
              </div>
            );
          })}
        </dl>
      </Card>

      {usingDefault && (
        <div className="rounded-xl bg-warning-50 px-3 py-2 text-xs text-warning-700">
          You&apos;re still using the default password. Please change it.
        </div>
      )}

      <button
        onClick={() => setPwOpen(true)}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3 text-sm font-medium text-brown-700 shadow-card hover:bg-canvas"
      >
        <Lock className="h-4 w-4" /> Change password
      </button>

      <button
        onClick={logout}
        className="flex w-full items-center justify-center gap-2 rounded-xl bg-red-50 py-3 text-sm font-semibold text-red-600 hover:bg-red-100"
      >
        <LogOut className="h-4 w-4" /> Log out
      </button>

      <Modal
        open={pwOpen}
        onClose={() => setPwOpen(false)}
        title="Change Password"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setPwOpen(false)}>Cancel</Button>
            <Button onClick={changePassword}>Save</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Current password"
            type="password"
            value={pw.current}
            onChange={(e) => setPw((s) => ({ ...s, current: e.target.value }))}
          />
          <Input
            label="New password"
            type="password"
            value={pw.next}
            onChange={(e) => setPw((s) => ({ ...s, next: e.target.value }))}
            placeholder="At least 6 characters"
          />
          <Input
            label="Confirm new password"
            type="password"
            value={pw.confirm}
            onChange={(e) => setPw((s) => ({ ...s, confirm: e.target.value }))}
          />
        </div>
      </Modal>
    </div>
  );
}
