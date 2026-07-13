"use client";

import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { LifeBuoy, Plus, Paperclip, X } from "lucide-react";
import Image from "next/image";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Textarea from "@/components/ui/Textarea";
import Modal from "@/components/ui/Modal";
import Badge from "@/components/ui/Badge";
import Table, { type Column } from "@/components/ui/Table";
import { useToast } from "@/components/ui/Toast";
import { useCurrentMerchant } from "@/hooks/useCurrentMerchant";
import { useTickets, createTicket, ticketsForMerchant } from "@/lib/support-store";
import {
  SUPPORT_STATUS_META,
  SUPPORT_CATEGORY_META,
  SUPPORT_PRIORITY_META,
} from "@/lib/constants";
import { formatDateTime } from "@/lib/utils";
import type { SupportTicket, SupportCategory, SupportPriority } from "@/types";

const CATEGORY_OPTIONS = (Object.keys(SUPPORT_CATEGORY_META) as SupportCategory[]).map(
  (c) => ({ value: c, label: SUPPORT_CATEGORY_META[c] }),
);
const PRIORITY_OPTIONS = (Object.keys(SUPPORT_PRIORITY_META) as SupportPriority[]).map(
  (p) => ({ value: p, label: SUPPORT_PRIORITY_META[p].label }),
);

const EMPTY = {
  subject: "",
  category: "parcel" as SupportCategory,
  priority: "medium" as SupportPriority,
  trackingId: "",
  body: "",
};

export default function MerchantSupportPage() {
  const router = useRouter();
  const toast = useToast();
  const me = useCurrentMerchant()!; // guaranteed by MerchantGate
  const all = useTickets();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [attachment, setAttachment] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const mine = useMemo(() => ticketsForMerchant(all, me.id), [all, me.id]);

  const pickFile = (file?: File) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Please select an image file");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Image must be under 2MB");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => setAttachment(reader.result as string);
    reader.readAsDataURL(file);
  };

  const openModal = () => {
    setForm(EMPTY);
    setAttachment(null);
    setOpen(true);
  };

  const submit = async () => {
    if (!form.subject.trim()) {
      toast.error("Please enter a subject");
      return;
    }
    if (!form.body.trim()) {
      toast.error("Please describe your issue");
      return;
    }
    try {
      const ticket = await createTicket({
        merchantId: me.id,
        merchantName: me.name,
        subject: form.subject.trim(),
        category: form.category,
        priority: form.priority,
        trackingId: form.trackingId.trim() || undefined,
        body: form.body.trim(),
        attachment: attachment ?? undefined,
      });
      setOpen(false);
      if (ticket) {
        toast.success(`Ticket ${ticket.ref} created`);
        router.push(`/merchant/support/${ticket.id}`);
      }
    } catch {
      toast.error("Could not create the ticket. Please try again.");
    }
  };

  const columns: Column<SupportTicket>[] = [
    {
      key: "ref",
      header: "Ticket",
      render: (t) => (
        <span className="flex items-center gap-2">
          {t.unreadForMerchant && (
            <span className="h-2 w-2 shrink-0 rounded-full bg-primary" title="New reply" />
          )}
          <span className="font-mono text-xs text-brown-500">{t.ref}</span>
        </span>
      ),
    },
    {
      key: "subject",
      header: "Subject",
      render: (t) => (
        <div className="min-w-0">
          <p className="truncate font-medium text-brown-800">{t.subject}</p>
          <p className="text-xs text-brown-500">{SUPPORT_CATEGORY_META[t.category]}</p>
        </div>
      ),
    },
    {
      key: "priority",
      header: "Priority",
      render: (t) => (
        <Badge className={SUPPORT_PRIORITY_META[t.priority].classes}>
          {SUPPORT_PRIORITY_META[t.priority].label}
        </Badge>
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (t) => (
        <Badge className={SUPPORT_STATUS_META[t.status].classes}>
          {SUPPORT_STATUS_META[t.status].label}
        </Badge>
      ),
    },
    {
      key: "updatedAt",
      header: "Last Update",
      render: (t) => (
        <span className="text-xs text-brown-500">{formatDateTime(t.updatedAt)}</span>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold tracking-tight text-brown-800">Support</h1>
          <p className="text-sm text-brown-500">
            Raise a ticket and our team will get back to you.
          </p>
        </div>
        <Button onClick={openModal}>
          <Plus className="h-4 w-4" /> New Ticket
        </Button>
      </div>

      <Card bodyClassName="p-0">
        <Table
          columns={columns}
          data={mine}
          rowKey={(t) => t.id}
          onRowClick={(t) => router.push(`/merchant/support/${t.id}`)}
          emptyMessage="No tickets yet. Open one if you need help."
          className="border-0 shadow-none"
        />
      </Card>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="New Support Ticket"
        footer={
          <>
            <Button variant="ghost" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={submit}>
              <LifeBuoy className="h-4 w-4" /> Create Ticket
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Subject"
            value={form.subject}
            onChange={(e) => setForm((f) => ({ ...f, subject: e.target.value }))}
            placeholder="Brief summary of the issue"
          />
          <div className="grid grid-cols-2 gap-3">
            <Select
              label="Category"
              value={form.category}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value as SupportCategory }))}
              options={CATEGORY_OPTIONS}
            />
            <Select
              label="Priority"
              value={form.priority}
              onChange={(e) => setForm((f) => ({ ...f, priority: e.target.value as SupportPriority }))}
              options={PRIORITY_OPTIONS}
            />
          </div>
          <Input
            label="Related Tracking ID (optional)"
            value={form.trackingId}
            onChange={(e) => setForm((f) => ({ ...f, trackingId: e.target.value }))}
            placeholder="e.g. CMS-2025-100006"
          />
          <Textarea
            label="Describe your issue"
            rows={4}
            value={form.body}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder="Tell us what happened…"
          />

          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => pickFile(e.target.files?.[0])}
          />
          {attachment ? (
            <div className="relative inline-block">
              <Image
                src={attachment}
                alt="Attachment"
                width={120}
                height={90}
                unoptimized
                className="h-20 w-auto rounded-lg border border-brown-100 object-cover"
              />
              <button
                type="button"
                onClick={() => setAttachment(null)}
                className="absolute -right-2 -top-2 flex h-6 w-6 items-center justify-center rounded-full bg-black/60 text-white"
                aria-label="Remove attachment"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="inline-flex items-center gap-1.5 text-sm text-brown-500 hover:text-primary"
            >
              <Paperclip className="h-4 w-4" /> Attach a screenshot (optional)
            </button>
          )}
        </div>
      </Modal>
    </div>
  );
}
