"use client";

import { useEffect, useState } from "react";
import {
  KeyRound,
  Plus,
  Trash2,
  Copy,
  Check,
  Terminal,
  Webhook,
  ShieldCheck,
} from "lucide-react";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import Modal from "@/components/ui/Modal";
import Table, { type Column } from "@/components/ui/Table";
import Badge from "@/components/ui/Badge";
import { useToast } from "@/components/ui/Toast";
import {
  listApiKeys,
  createApiKey,
  revokeApiKey,
  type ApiKey,
  type CreatedApiKey,
} from "@/lib/api/merchant-keys";
import {
  getWebhook,
  saveWebhook,
  listWebhookDeliveries,
  type WebhookDelivery,
} from "@/lib/api/merchant-webhooks";
import { formatDate, formatDateTime } from "@/lib/utils";

// Base URL of the public merchant API (…/api/v1 → …/api/merchant/v1).
const API_BASE = (process.env.NEXT_PUBLIC_API_URL || "https://your-domain/api/v1").replace(
  /\/api\/v1\/?$/,
  "/api/merchant/v1",
);

/** Small labelled code block with a copy button. */
function CodeBlock({
  code,
  id,
  copied,
  onCopy,
  label,
}: {
  code: string;
  id: string;
  copied: string | null;
  onCopy: (text: string, id: string) => void;
  label?: string;
}) {
  return (
    <div>
      {label ? (
        <div className="mb-1.5 flex items-center justify-between">
          <span className="text-xs font-medium uppercase tracking-wide text-brown-400">
            {label}
          </span>
          <button
            onClick={() => onCopy(code, id)}
            className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
          >
            {copied === id ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            {copied === id ? "Copied" : "Copy"}
          </button>
        </div>
      ) : null}
      <pre className="overflow-x-auto rounded-lg bg-brown-900 p-4 text-xs leading-relaxed text-brown-100">
        {code}
      </pre>
    </div>
  );
}

/** Reusable field-reference table. */
function FieldTable({
  rows,
  cols = ["Field", "Type", "Required", "Description"],
}: {
  rows: string[][];
  cols?: string[];
}) {
  return (
    <div className="overflow-x-auto rounded-lg border border-brown-100">
      <table className="w-full text-left text-sm">
        <thead>
          <tr className="border-b border-brown-100 bg-brown-50/50 text-[11px] uppercase tracking-wide text-brown-400">
            {cols.map((c) => (
              <th key={c} className="px-3 py-2 font-medium">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i} className="border-b border-brown-100 last:border-0 align-top">
              {r.map((cell, j) => (
                <td
                  key={j}
                  className={
                    j === 0
                      ? "px-3 py-2 font-mono text-xs text-brown-700 whitespace-nowrap"
                      : "px-3 py-2 text-brown-600"
                  }
                >
                  {j === 2 ? (
                    <span className={cell === "required" ? "text-danger-600 font-medium" : "text-brown-400"}>
                      {cell}
                    </span>
                  ) : (
                    cell
                  )}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export default function DevelopersPage() {
  const toast = useToast();
  const [keys, setKeys] = useState<ApiKey[]>([]);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [newCreds, setNewCreds] = useState<CreatedApiKey | null>(null);
  const [revokeTarget, setRevokeTarget] = useState<ApiKey | null>(null);
  const [copied, setCopied] = useState<string | null>(null);

  // Webhook config + delivery log
  const [webhookUrl, setWebhookUrl] = useState("");
  const [authToken, setAuthToken] = useState("");
  const [webhookActive, setWebhookActive] = useState(false);
  const [savingHook, setSavingHook] = useState(false);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);

  const load = () => {
    listApiKeys()
      .then(setKeys)
      .catch(() => {})
      .finally(() => setLoading(false));
  };
  useEffect(load, []);

  useEffect(() => {
    getWebhook()
      .then((w) => {
        setWebhookUrl(w.url || "");
        setAuthToken(w.authToken || "");
        setWebhookActive(w.isActive);
      })
      .catch(() => {});
    listWebhookDeliveries().then(setDeliveries).catch(() => {});
  }, []);

  const copy = async (text: string, id: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(id);
      setTimeout(() => setCopied(null), 1500);
    } catch {
      toast.error("Copy failed — select and copy manually.");
    }
  };

  const create = async () => {
    try {
      const created = await createApiKey(label.trim() || "API key");
      setCreateOpen(false);
      setLabel("");
      setNewCreds(created); // show once
      load();
    } catch {
      toast.error("Could not create credentials. Please try again.");
    }
  };

  const revoke = async () => {
    if (!revokeTarget) return;
    try {
      await revokeApiKey(revokeTarget.id);
      toast.success("Credentials revoked");
      setRevokeTarget(null);
      load();
    } catch {
      toast.error("Could not revoke credentials.");
    }
  };

  const saveHook = async () => {
    setSavingHook(true);
    try {
      await saveWebhook({
        url: webhookUrl.trim(),
        authToken: authToken.trim(),
        isActive: webhookActive,
      });
      toast.success("Webhook saved");
      listWebhookDeliveries().then(setDeliveries).catch(() => {});
    } catch {
      toast.error("Could not save webhook. Check the URL and try again.");
    } finally {
      setSavingHook(false);
    }
  };

  const columns: Column<ApiKey>[] = [
    {
      key: "label",
      header: "Label",
      render: (k) => <span className="font-medium text-brown-800">{k.label}</span>,
    },
    {
      key: "apiKey",
      header: "Api-Key",
      render: (k) => (
        <button
          onClick={() => copy(k.apiKey, `list-${k.id}`)}
          className="inline-flex items-center gap-1 font-mono text-xs text-brown-600 hover:text-brown-900"
          title="Copy Api-Key"
        >
          {k.apiKey.slice(0, 16)}…
          {copied === `list-${k.id}` ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
        </button>
      ),
    },
    { key: "createdAt", header: "Created", render: (k) => formatDate(k.createdAt) },
    {
      key: "lastUsedAt",
      header: "Last used",
      render: (k) => (k.lastUsedAt ? formatDate(k.lastUsedAt) : "Never"),
    },
    {
      key: "actions",
      header: "",
      className: "text-right",
      render: (k) => (
        <Button size="sm" variant="danger" onClick={() => setRevokeTarget(k)}>
          <Trash2 className="h-3.5 w-3.5" /> Revoke
        </Button>
      ),
    },
  ];

  const curlCreate = `curl -X POST ${API_BASE}/create_order \\
  -H "Api-Key: YOUR_API_KEY" \\
  -H "Secret-Key: YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "invoice": "ORD-1001",
    "recipient_name": "John Smith",
    "recipient_phone": "01712345678",
    "recipient_address": "House 17, Road 3A, Dhanmondi, Dhaka-1209",
    "cod_amount": 1060,
    "note": "Deliver before 3 PM",
    "item_description": "T-shirt (2 pcs)",
    "delivery_type": 0
  }'`;

  const respCreate = `{
  "status": 200,
  "message": "Consignment has been created successfully.",
  "consignment": {
    "consignment_id": 1424107,
    "invoice": "ORD-1001",
    "tracking_code": "CMS-2026-393071",
    "recipient_name": "John Smith",
    "recipient_phone": "01712345678",
    "recipient_address": "House 17, Road 3A, Dhanmondi, Dhaka-1209",
    "cod_amount": 1060,
    "status": "in_review",
    "note": "Deliver before 3 PM",
    "created_at": "2026-07-05",
    "updated_at": "2026-07-05T09:55:00Z"
  }
}`;

  const reqBulk = `curl -X POST ${API_BASE}/create_order/bulk-order \\
  -H "Api-Key: YOUR_API_KEY" \\
  -H "Secret-Key: YOUR_SECRET_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{
    "data": [
      { "invoice": "ORD-1", "recipient_name": "A Khan",
        "recipient_phone": "01700000001",
        "recipient_address": "Gulshan 1, Dhaka", "cod_amount": 500 },
      { "invoice": "ORD-2", "recipient_name": "B Roy",
        "recipient_phone": "01700000002",
        "recipient_address": "Dhanmondi 27, Dhaka", "cod_amount": 0 }
    ]
  }'`;

  const respBulk = `{
  "status": 200,
  "data": [
    { "invoice": "ORD-1", "recipient_name": "A Khan", "cod_amount": 500,
      "consignment_id": 33, "tracking_code": "CMS-2026-531563", "status": "success" },
    { "invoice": "ORD-2", "recipient_name": "B Roy", "cod_amount": 0,
      "consignment_id": 34, "tracking_code": "CMS-2026-223679", "status": "success" }
  ]
}
// A row that fails validation comes back with
// "status": "error" and a "message" explaining why.`;

  const payloadDelivery = `{
  "notification_type": "delivery_status",
  "consignment_id": 1424107,
  "invoice": "ORD-1001",
  "cod_amount": 1060.00,
  "status": "delivered",
  "delivery_charge": 100.00,
  "tracking_message": "Your parcel has been delivered successfully.",
  "updated_at": "2026-07-05 12:45:30"
}`;

  const payloadTracking = `{
  "notification_type": "tracking_update",
  "consignment_id": 1424107,
  "invoice": "ORD-1001",
  "tracking_message": "Your parcel is out for delivery.",
  "updated_at": "2026-07-05 13:15:00"
}`;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-lg font-semibold tracking-tight text-brown-900">Developer API</h1>
        <p className="text-sm text-brown-500">
          Create and track parcels straight from your website or ERP. Authenticate
          every request with your <span className="font-medium">Api-Key</span> and{" "}
          <span className="font-medium">Secret-Key</span>.
        </p>
      </div>

      {/* ---- API credentials ---- */}
      <Card
        title="API Credentials"
        action={
          <Button size="sm" onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Create credentials
          </Button>
        }
        bodyClassName="p-0"
      >
        {loading ? (
          <p className="p-5 text-sm text-brown-500">Loading…</p>
        ) : (
          <Table
            columns={columns}
            data={keys}
            rowKey={(k) => k.id}
            emptyMessage="No credentials yet. Create a pair to start integrating."
            className="border-0 shadow-none"
          />
        )}
      </Card>

      {/* ---- Getting started / auth ---- */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> Authentication
          </span>
        }
      >
        <p className="text-sm text-brown-500">
          Base URL: <span className="font-mono text-brown-700">{API_BASE}</span>
        </p>
        <p className="mt-2 text-sm text-brown-500">
          Send these headers with every request. Keep your Secret-Key private —
          never expose it in browser/client-side code.
        </p>
        <div className="mt-3">
          <FieldTable
            cols={["Header", "Value"]}
            rows={[
              ["Api-Key", "Your Api-Key (from the table above)"],
              ["Secret-Key", "Your Secret-Key (shown once at creation)"],
              ["Content-Type", "application/json"],
            ]}
          />
        </div>
      </Card>

      {/* ---- Create order ---- */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Terminal className="h-4 w-4" /> Create an order
          </span>
        }
      >
        <p className="text-sm text-brown-500">
          <span className="font-mono text-brown-700">POST /create_order</span> — books a
          single consignment. Coverage is currently{" "}
          <span className="font-medium">Dhaka</span>; the delivery area is taken from{" "}
          <span className="font-mono text-brown-700">recipient_area</span> if provided,
          otherwise detected from the address.
        </p>

        <div className="mt-3">
          <FieldTable
            rows={[
              ["invoice", "string", "required", "Your unique order reference. Letters, numbers, - and _ only."],
              ["recipient_name", "string", "required", "Recipient full name (≤100 chars)."],
              ["recipient_phone", "string", "required", "11-digit phone, e.g. 01712345678."],
              ["recipient_address", "string", "required", "Full delivery address (≤250 chars)."],
              ["cod_amount", "number", "required", "Cash to collect in ৳ (0 for non-COD)."],
              ["alternative_phone", "string", "optional", "Second 11-digit contact number."],
              ["recipient_email", "string", "optional", "Recipient email."],
              ["recipient_area", "string", "optional", "Delivery area/thana (e.g. Gulshan) to route accurately."],
              ["note", "string", "optional", "Delivery instructions."],
              ["item_description", "string", "optional", "What's inside the parcel."],
              ["total_lot", "number", "optional", "Number of items/lots."],
              ["delivery_type", "number", "optional", "0 = home delivery (default), 1 = hub pickup."],
            ]}
          />
        </div>

        <div className="mt-4 space-y-4">
          <CodeBlock label="Request (cURL)" code={curlCreate} id="curl" copied={copied} onCopy={copy} />
          <CodeBlock label="Response" code={respCreate} id="resp" copied={copied} onCopy={copy} />
        </div>
      </Card>

      {/* ---- Bulk create ---- */}
      <Card title="Bulk order create">
        <p className="text-sm text-brown-500">
          <span className="font-mono text-brown-700">POST /create_order/bulk-order</span> —
          create up to <span className="font-medium">500</span> consignments in one call.
          Pass an array under <span className="font-mono text-brown-700">data</span> (each
          item uses the same fields as a single order). Rows are processed
          independently — a bad row is returned with{" "}
          <span className="font-mono text-brown-700">status: &quot;error&quot;</span> and
          doesn&apos;t fail the rest.
        </p>
        <div className="mt-4 space-y-4">
          <CodeBlock label="Request" code={reqBulk} id="bulkreq" copied={copied} onCopy={copy} />
          <CodeBlock label="Result" code={respBulk} id="bulkresp" copied={copied} onCopy={copy} />
        </div>
      </Card>

      {/* ---- Statuses ---- */}
      <Card title="Order statuses">
        <p className="text-sm text-brown-500">
          The <span className="font-mono text-brown-700">status</span> field (in responses
          and webhooks) uses these values:
        </p>
        <div className="mt-3">
          <FieldTable
            cols={["Status", "Meaning"]}
            rows={[
              ["in_review", "Order placed, waiting to be processed / picked up."],
              ["pending", "Accepted and in progress (picked up, in transit, or out for delivery)."],
              ["delivered", "Delivered and COD collected."],
              ["partial_delivered", "Partially delivered."],
              ["cancelled", "Cancelled or returned to sender."],
              ["unknown", "Unknown status — contact support."],
            ]}
          />
        </div>
      </Card>

      {/* ---- Webhooks ---- */}
      <Card
        title={
          <span className="flex items-center gap-2">
            <Webhook className="h-4 w-4" /> Webhooks
          </span>
        }
      >
        <p className="text-sm text-brown-500">
          We POST a JSON event to your Callback URL whenever one of your parcels
          moves or changes delivery status — so your system stays in sync without
          polling. Set your endpoint and (optional) auth token below.
        </p>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Input
            label="Callback URL"
            value={webhookUrl}
            onChange={(e) => setWebhookUrl(e.target.value)}
            placeholder="https://your-site.com/webhooks/ecourier"
          />
          <Input
            label="Auth Token (Bearer)"
            value={authToken}
            onChange={(e) => setAuthToken(e.target.value)}
            placeholder="Optional — we send it as Authorization: Bearer …"
          />
        </div>
        <div className="mt-3 flex items-center gap-3">
          <label className="flex items-center gap-2 text-sm text-brown-600">
            <input
              type="checkbox"
              checked={webhookActive}
              onChange={(e) => setWebhookActive(e.target.checked)}
              className="h-4 w-4 rounded border-brown-300 text-primary focus:ring-primary"
            />
            Active
          </label>
          <Button size="sm" onClick={saveHook} disabled={savingHook}>
            {savingHook ? "Saving…" : "Save webhook"}
          </Button>
        </div>

        <div className="mt-5 space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-brown-400">
            Headers we send
          </span>
          <div className="mt-1.5">
            <FieldTable
              cols={["Header", "Value"]}
              rows={[
                ["Content-Type", "application/json"],
                ["Authorization", "Bearer {your auth token} (if set)"],
              ]}
            />
          </div>
        </div>

        {/* delivery_status */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-brown-800">1. Delivery status update</h4>
          <p className="mt-1 text-sm text-brown-500">
            Sent when a parcel is delivered, partially delivered, cancelled or returned.
          </p>
          <div className="mt-2 space-y-3">
            <CodeBlock label="Example payload" code={payloadDelivery} id="pd" copied={copied} onCopy={copy} />
            <FieldTable
              rows={[
                ["notification_type", "string", "—", 'Fixed: "delivery_status".'],
                ["consignment_id", "integer", "—", "Our unique consignment ID."],
                ["invoice", "string", "—", "Your invoice reference."],
                ["cod_amount", "number", "—", "COD amount in ৳."],
                ["status", "string", "—", "delivered / partial_delivered / cancelled / pending."],
                ["delivery_charge", "number", "—", "Delivery charge applied."],
                ["tracking_message", "string", "—", "Human-readable status message."],
                ["updated_at", "datetime", "—", "YYYY-MM-DD HH:MM:SS."],
              ]}
            />
          </div>
        </div>

        {/* tracking_update */}
        <div className="mt-5">
          <h4 className="text-sm font-semibold text-brown-800">2. Tracking update</h4>
          <p className="mt-1 text-sm text-brown-500">
            Sent on movement events (picked up, in transit, at hub, out for delivery).
          </p>
          <div className="mt-2 space-y-3">
            <CodeBlock label="Example payload" code={payloadTracking} id="pt" copied={copied} onCopy={copy} />
            <FieldTable
              rows={[
                ["notification_type", "string", "—", 'Fixed: "tracking_update".'],
                ["consignment_id", "integer", "—", "Our unique consignment ID."],
                ["invoice", "string", "—", "Your invoice reference."],
                ["tracking_message", "string", "—", "Tracking update message."],
                ["updated_at", "datetime", "—", "YYYY-MM-DD HH:MM:SS."],
              ]}
            />
          </div>
        </div>

        <div className="mt-5 rounded-lg border border-brown-100 bg-brown-50/50 p-3 text-sm text-brown-600">
          <span className="font-medium text-brown-800">Responding:</span> reply with
          HTTP <span className="font-mono">200 OK</span> to acknowledge. Non-2xx or
          timeouts are recorded below as failed and can be retried from your side.
        </div>

        {/* recent deliveries */}
        <div className="mt-5">
          <span className="text-xs font-medium uppercase tracking-wide text-brown-400">
            Recent deliveries
          </span>
          <div className="mt-2 overflow-x-auto rounded-lg border border-brown-100">
            {deliveries.length === 0 ? (
              <p className="px-3 py-6 text-center text-sm text-brown-400">
                No deliveries yet. They&apos;ll appear here once events start firing.
              </p>
            ) : (
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-brown-100 bg-brown-50/50 text-[11px] uppercase tracking-wide text-brown-400">
                    <th className="px-3 py-2">Type</th>
                    <th className="px-3 py-2">Parcel</th>
                    <th className="px-3 py-2">Result</th>
                    <th className="px-3 py-2">When</th>
                  </tr>
                </thead>
                <tbody>
                  {deliveries.map((d) => (
                    <tr key={d.id} className="border-b border-brown-100 last:border-0">
                      <td className="px-3 py-2 font-mono text-xs text-brown-700">{d.event}</td>
                      <td className="px-3 py-2 font-mono text-xs text-brown-600">{d.trackingId}</td>
                      <td className="px-3 py-2">
                        {d.ok ? (
                          <Badge className="bg-success-100 text-success-700">
                            {d.statusCode ?? "OK"}
                          </Badge>
                        ) : (
                          <Badge className="bg-danger-100 text-danger-700">
                            {d.statusCode ?? "Failed"}
                          </Badge>
                        )}
                      </td>
                      <td className="px-3 py-2 text-brown-500">{formatDateTime(d.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Card>

      {/* ---- Create credentials modal ---- */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create API credentials"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setCreateOpen(false)}>Cancel</Button>
            <Button onClick={create}>Create</Button>
          </>
        }
      >
        <Input
          label="Label"
          value={label}
          onChange={(e) => setLabel(e.target.value)}
          placeholder="e.g. My website, Staging server"
        />
      </Modal>

      {/* ---- One-time credentials modal ---- */}
      <Modal
        open={newCreds != null}
        onClose={() => setNewCreds(null)}
        title="Your new API credentials"
        footer={<Button onClick={() => setNewCreds(null)}>Done</Button>}
      >
        <div className="space-y-3">
          <div className="rounded-lg border border-warning-200 bg-warning-50 px-3 py-2 text-xs text-warning-700">
            Copy your Secret-Key now — for security it won&apos;t be shown again. The
            Api-Key stays visible in your credentials list.
          </div>
          {newCreds ? (
            <>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-brown-400">Api-Key</span>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-brown-200 bg-canvas p-3">
                  <KeyRound className="h-4 w-4 shrink-0 text-brown-400" />
                  <code className="flex-1 break-all font-mono text-xs text-brown-800">{newCreds.apiKey}</code>
                  <button
                    onClick={() => copy(newCreds.apiKey, "newapi")}
                    className="inline-flex items-center gap-1 rounded-md border border-brown-200 px-2 py-1 text-xs font-medium text-brown-700 hover:bg-brown-50"
                  >
                    {copied === "newapi" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "newapi" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
              <div>
                <span className="text-xs font-medium uppercase tracking-wide text-brown-400">Secret-Key</span>
                <div className="mt-1 flex items-center gap-2 rounded-lg border border-brown-200 bg-canvas p-3">
                  <KeyRound className="h-4 w-4 shrink-0 text-brown-400" />
                  <code className="flex-1 break-all font-mono text-xs text-brown-800">{newCreds.secretKey}</code>
                  <button
                    onClick={() => copy(newCreds.secretKey, "newsecret")}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-2 py-1 text-xs font-medium text-white hover:bg-primary-700"
                  >
                    {copied === "newsecret" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === "newsecret" ? "Copied" : "Copy"}
                  </button>
                </div>
              </div>
            </>
          ) : null}
        </div>
      </Modal>

      {/* ---- Revoke confirm ---- */}
      <Modal
        open={revokeTarget != null}
        onClose={() => setRevokeTarget(null)}
        title="Revoke these credentials?"
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => setRevokeTarget(null)}>Cancel</Button>
            <Button variant="danger" onClick={revoke}>Revoke</Button>
          </>
        }
      >
        <p className="text-sm text-brown-600">
          Requests using <span className="font-mono">{revokeTarget?.apiKey.slice(0, 16)}…</span> will
          immediately stop working. This cannot be undone.
        </p>
      </Modal>
    </div>
  );
}
