# Merchant Support System — Design & Implementation Plan

> Status: **Proposal — pending review & decisions.** No code until the
> "Open Decisions" section is signed off.
> Builds on existing patterns: the `createStore` factory (payment-store),
> `useCurrentMerchant`, role-based nav, and status-meta badges.

---

## 1. Goal

Give **merchants** a way to raise **support tickets** (questions/complaints/
requests) and message back and forth, and give **admin** a console to triage,
reply, and resolve them. A two-way threaded conversation with a status workflow.

```
Merchant opens ticket → Admin sees it → Admin replies → Merchant replies …
                                   │
                                   ▼
                    Resolved → Closed (reopen on new reply)
```

---

## 2. Where It Fits

- **Merchant panel:** new **"Support"** nav item → list of *their* tickets,
  create new, open a thread, reply, close.
- **Admin panel:** new **"Support"** nav item → list of *all* tickets, filter by
  status, open a thread, reply, set status/priority. Open-ticket count badge.
- No backend yet — an in-memory `support-store` (resets on reload), same as the
  rest of the mock. The Django backend later mirrors the model + scoping.

---

## 3. Data Model

```ts
type SupportStatus = "open" | "in_progress" | "resolved" | "closed";
type SupportCategory = "parcel" | "payment" | "pickup" | "account" | "other";
type SupportPriority = "low" | "medium" | "high";          // (Decision 3)

interface SupportMessage {
  id: number;
  sender: "merchant" | "admin";
  senderName: string;
  body: string;
  attachment?: string;        // image data URL (Decision 2)
  createdAt: string;          // ISO datetime
}

interface SupportTicket {
  id: number;
  ref: string;                // e.g. TKT-0001
  merchantId: number;
  merchantName: string;
  subject: string;
  category: SupportCategory;
  priority: SupportPriority;
  status: SupportStatus;
  trackingId?: string;        // optional link to a parcel (Decision 4)
  messages: SupportMessage[]; // first message = the merchant's opening message
  createdAt: string;
  updatedAt: string;
  unreadForAdmin: boolean;    // set when merchant posts, cleared when admin opens
  unreadForMerchant: boolean; // set when admin posts, cleared when merchant opens
}
```

`SUPPORT_STATUS_META` (label + Tailwind classes) added to `constants.ts`,
alongside the existing parcel/merchant/withdrawal metas.

---

## 4. Status Workflow

| Event | New status |
|-------|-----------|
| Merchant creates ticket | **open** |
| Admin replies | **in_progress** |
| Admin marks resolved | **resolved** |
| Anyone closes | **closed** |
| Merchant replies on a resolved/closed ticket | **open** (reopened) |

Admin can override status manually from the ticket detail. (Decision 1 may
collapse this to a simpler set.)

---

## 5. Store — `lib/support-store.ts`

Uses the shared `createStore` factory. Seed from
`lib/mock-data/support-tickets.json` (2–3 sample tickets).

```ts
useTickets(): SupportTicket[]
createTicket(data): SupportTicket            // status "open", ref TKT-XXXX, opening message
addTicketMessage(id, sender, senderName, body, attachment?)  // bumps updatedAt + status + unread flags
setTicketStatus(id, status)
setTicketPriority(id, priority)
markTicketRead(id, side: "admin" | "merchant")   // clears the unread flag
ticketsForMerchant(list, merchantId)
openCount(list): number                       // for the admin badge
```

---

## 6. Pages & Components

### Merchant
- **`/merchant/support`** — list of own tickets (ref, subject, category,
  status badge, last-updated, unread dot). **"New Ticket"** button → modal
  (subject, category, optional tracking ID, opening message, optional
  attachment).
- **`/merchant/support/[id]`** — thread view (message bubbles, merchant right /
  admin left), reply box (+ optional attachment), **Close** / **Reopen**.

### Admin
- **`/admin/support`** — all tickets with a status filter + search (merchant /
  subject / ref), open-count summary. Row click → detail.
- **`/admin/support/[id]`** — thread, merchant + related-parcel info sidebar,
  reply box, **status** control (Open / In Progress / Resolved / Closed) and
  **priority** control.

### Shared
- Reuse Card, Modal, Input, Textarea, Select, Badge, Table, StatusBadge-style
  badge (or a small inline badge using `SUPPORT_STATUS_META`).
- A small **unread badge** on the "Support" nav item (count of unread tickets
  for that side).

---

## 7. Scoping

- Merchant pages filter `merchantId === me.id` (via `useCurrentMerchant`) and
  404 a ticket that isn't theirs (same guard style as rider parcel detail).
- Admin sees everything.

---

## 8. Integration Points

- **constants.ts:** add `{ label: "Support", href, icon: LifeBuoy }` to
  `MERCHANT_NAV` and `ADMIN_NAV`; add `SUPPORT_STATUS_META`.
- **types/index.ts:** the interfaces in §3.
- **No changes** to parcels, COD, or auth. Tracking-ID link is a soft reference
  (string), not a hard relation.

---

## 9. Phased Build

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0. Decisions** | Sign off this doc (blocking). | ✅ Done |
| **A. Core + Merchant** | types + `SUPPORT_STATUS_META` + `support-store` + seed; merchant Support list, New Ticket, thread + reply + close; nav item. | ✅ Done |
| **B. Admin** | admin Support list (filter/search + open/unread/resolved tiles), thread + reply + status/priority controls, merchant + related-parcel sidebar. | ✅ Done |
| **C. Polish** | unread **count badge on the sidebar + mobile nav** (`useNavBadges`), admin dashboard **Support Tickets** card (open + unread). (Attachments + parcel deep link shipped in A/B.) Email/in-app push deferred to the backend. | ✅ Done |

Each phase verified with `tsc` / `next lint` / `next build`.

---

## 10. Decisions — LOCKED ✅

| # | Decision | Chosen | Implication |
|---|----------|--------|-------------|
| 1 | Status set | **Open / In Progress / Resolved / Closed** | Full lifecycle per §4. Admin reply → In Progress; admin can mark Resolved; either side Closes; merchant reply reopens to Open. |
| 2 | Attachments | **Yes — image attachments** | Both sides can attach one image per message (data URL, ≤2MB), same approach as the rider delivery proof. |
| 3 | Priority | **Merchant sets on create** | New-ticket form has a Low/Medium/High picker (default Medium); admin can change it from the detail. |
| 4 | Parcel link | **Yes — optional tracking ID** | New-ticket form has an optional tracking-ID field; admin detail shows it with a deep link to the parcel. Soft string reference, not a hard relation. |

All four are reflected in the §3 model (kept `attachment?`, `priority`,
`trackingId?`).
