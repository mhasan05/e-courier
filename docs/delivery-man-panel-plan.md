# Delivery Man Panel — Design & Implementation Plan

> Status: **Proposal — pending review & decisions.** No code until the "Open
> Decisions" section is signed off.
> Builds on the existing multi-branch system (hubs, ownership scoping, COD
> remittance) and the delivery-man records admin already manages.

---

## 1. Goal

Give each **delivery man (rider)** their own login and a **mobile-first panel**
to do their day-to-day job: see assigned parcels, update delivery status with
proof, collect Cash-on-Delivery, and hand the cash over to their hub. Today
riders are only *records* created by admin/branch managers — this turns them
into *users*.

---

## 2. Where It Fits

```
Merchant books → Hub assigns rider → RIDER picks up / delivers → collects COD
                                              │
                                              ▼
                        Rider hands cash to Hub → Hub remits to HQ → HQ pays merchant
```

The rider panel is the operational front-line that completes the parcel
lifecycle and the COD chain (the hub→HQ→merchant legs already exist).

---

## 3. Roles & Auth

- New role **`delivery_man`** (alongside admin / branch_manager / merchant).
- **Login:** riders authenticate against the existing **delivery-man store**
  (their email/phone + the auto-generated password, default `12345678`). No new
  credential table — the store is the source of truth.
- **Session** carries `deliveryManId` (+ their `branchId`) so every page scopes
  to *their* tasks.
- `homeForRole("delivery_man")` → `/rider/dashboard`; route guard on `/rider/*`.
- Inactive riders cannot log in.
- **Change password** on first login / from profile (replaces the default).

---

## 4. Data Model Additions

Most data already exists (DeliveryMan, Parcel.deliveryManId, COD). New bits:

| Where | Field / entity | Purpose |
|-------|----------------|---------|
| `AuthSession` | `deliveryManId?` | scope the panel to the logged-in rider |
| `DeliveryMan` | `password` (already stored) + change-password action | real login |
| `ParcelStatusEvent` | optional `proof?: { recipientName?, photo?, note? }` | proof of delivery |
| New: `RiderHandover` | `{ id, riderId, branchId, amount, parcelCount, status: pending\|received, reference, remittedAt, receivedAt }` | rider → hub cash handover (mirrors the hub→HQ remittance) |
| `Parcel` (optional) | `codCollected?: boolean` | mark COD physically collected at delivery |

No change to pricing, zones, or ownership scoping.

---

## 5. Panel Features (pages)

Mobile-first. Proposed routes under `app/(rider)/rider/*`:

### 5.1 Login (shared `/login`, role-routed)
Phone/email + password → rider dashboard.

### 5.2 Dashboard `/rider/dashboard`
- Greeting + hub badge.
- Today's snapshot: **To Pick Up**, **Out for Delivery**, **Delivered Today**,
  **Failed/Returned**, **Cash in Hand (৳)**.
- Quick list of next tasks; "Hand over cash" CTA when cash in hand > 0.

### 5.3 Tasks / My Parcels `/rider/parcels`
- All parcels where `deliveryManId === me`. Tabs:
  **Pickup** (assigned, awaiting pickup) · **To Deliver** (in hand / out for delivery) ·
  **Delivered** · **Failed/Returned**.
- Each card: tracking ID, recipient + area, COD, status, **Call** button.

### 5.4 Parcel detail `/rider/parcels/[id]`
- Recipient (name, phone → call, address → open in maps), parcel + COD, timeline.
- **Action buttons by stage** (rider-only transitions, see §6):
  - Pickup task → **Mark Picked Up**.
  - Delivery task → **Start Delivery** (out for delivery) → **Delivered**
    (capture proof + confirm COD) / **Failed** (reason → return).
- **Proof of delivery** on "Delivered": recipient name (required) + optional
  photo + note.

### 5.5 COD / Cash `/rider/cod`
- **Cash in Hand** = COD collected on delivered parcels not yet handed over.
- List of collected COD (per parcel).
- **Hand over to hub** → creates a `RiderHandover` (pending); hub confirms
  receipt (new action on the branch COD page). History with status badges.

### 5.6 Profile `/rider/profile`
- View own details + documents (read-only), hub, status.
- **Change password**.

### 5.7 Notifications (optional, Phase C)
- New-assignment / reassignment alerts (in-app list; real push is the future
  native app).

---

## 6. Status Transitions a Rider Can Perform

Riders get a **constrained** set (not the full admin status dropdown):

| Current | Rider action → new status |
|---------|---------------------------|
| pending / picked_up at origin | **Picked Up** |
| at destination hub / received | **Out for Delivery** |
| out_for_delivery | **Delivered** (proof + COD) |
| out_for_delivery | **Failed** → `return_in_transit` (reason) |
| (partial allowed?) | **Partially Delivered** (optional) |

Every action logs a `ParcelStatusEvent` with the rider as `changedBy` and (for
delivery) the proof. Admin/branch retain full control.

---

## 7. Scoping

`deliveryManId === session.deliveryManId` on every list/detail. A rider can only
see and act on **their own** assigned parcels — enforced in a `useRiderScope()`
helper (and server-side later).

---

## 8. Layout (mobile-first)

Riders work on phones. Two options (Decision):
- **A. Bottom tab bar** (Home · Tasks · Cash · Profile) — native-app feel,
  recommended for riders.
- **B. Reuse the existing dashboard shell** (sidebar + topbar) like the other
  panels — faster to build, less rider-optimized.

Either way the content is responsive and touch-friendly (big tap targets,
sticky action bar on the parcel detail).

---

## 9. Integration With Existing Code

- **Auth:** extend `MOCK_CREDENTIALS`-style login to also check the delivery-man
  store; add `deliveryManId` to the session; `homeForRole`/guards.
- **Parcel store:** reuse `setParcelStatus` (+ proof param) for rider updates;
  reuse `assignDeliveryMan` (admin side, unchanged).
- **COD:** new `rider-handover-store` (like `remittance-store`); the branch COD
  page gains a "Rider Handovers" view to confirm receipt; hub collected COD can
  optionally reconcile against rider handovers.
- **Constants:** `RIDER_NAV`; `navForRole`/`panelLabelForRole` extended.
- **Components:** reuse Card, Table, StatusBadge, Modal, AvatarUploader, etc.

---

## 10. Phased Roadmap

| Phase | Deliverable | Status |
|-------|-------------|--------|
| **0. Decisions** | Sign off this doc (blocking). | ✅ Done |
| **A. Core panel** | `delivery_man` role + login + guard + mobile layout/nav; Dashboard; Tasks list; Parcel detail with rider status actions (Picked Up / Out for Delivery / Delivered / Failed). | ✅ Done |
| **B. COD & cash** | Cash-in-hand, per-parcel COD on delivery, rider→hub **handover** + hub confirmation; profile + change password. | ✅ Done |
| **C. Proof & polish** | Optional delivery proof (photo + note, on top of the required OTP), failed-reason capture, in-app assignment notifications, maps/call deep-links. | ✅ Done |

Each phase is shippable and verified (`tsc`/`lint`/`build`).

---

## 11. Decisions — LOCKED ✅

| # | Decision | Chosen | Implication |
|---|----------|--------|-------------|
| 1 | Layout | **Mobile bottom-tab app** | New `(rider)` route group with a bottom nav bar (Home / Tasks / Cash / Profile) + sticky action bars. Not the sidebar shell. |
| 2 | Rider scope | **Pickup + delivery** | Riders handle both **pickup tasks** (collect from merchant → Picked Up) and **delivery tasks** (Out for Delivery → Delivered/Failed). Tasks list groups both. |
| 3 | Proof of delivery | **OTP only** | On "Delivered", the rider must enter the parcel's **delivery OTP**. No recipient-name/photo capture required. |
| 4 | MVP scope | **Phases A–B** | Core panel + COD/cash + change-password now. Notifications/maps polish (Phase C) later. |
| 5 | Login identifier | **Phone (default)** | Riders log in with phone + password (email also accepted). Not separately asked — flag if you want email-only. |
| 6 | COD handover | **Rider → hub with hub confirmation (default)** | Mirrors hub→HQ remittance. Cash-in-hand does not block new tasks for MVP. |

### OTP model (mock)
Each parcel gets a **4-digit delivery OTP** (deterministic from its tracking ID
so it's stable and testable, e.g. last 4 digits or a hash). In a real system the
OTP is sent to the recipient; the rider asks for it and enters it. For the mock:
- The rider's "Delivered" action requires the correct OTP to proceed.
- For testing, the OTP is shown on the **admin/branch parcel detail** (and could
  appear on the customer tracker) so testers can complete a delivery.

---

## 12. Mock-Phase Notes

- A demo rider login (e.g. `jamal.rider@cms.com` / `12345678`) for testing.
- Stores are in-memory (reset on reload) like the rest of the mock; the real
  Django backend (later) implements the same role, scoping, and COD ledger.
- "Maps" = open the address in Google Maps; "Call" = `tel:` link. Photos are
  data URLs (as elsewhere) until real upload exists.

---

## 13. Build Plan — Phases A & B (locked path)

### Phase A — Core rider panel
1. **Types/auth:** add `delivery_man` role; `AuthSession.deliveryManId`; parcel
   `deliveryOtp` (derived) + optional proof on status event.
2. **Login:** authenticate riders against the delivery-man store (phone/email +
   password); block inactive; `homeForRole` → `/rider/dashboard`; demo rider on
   the login page.
3. **Mobile layout:** `(rider)` route group with bottom-tab nav + guard
   (`useRiderScope`), mobile-first container.
4. **Dashboard** `/rider/dashboard`: today's counts (to pick up, out for delivery,
   delivered, failed) + cash-in-hand + next tasks.
5. **Tasks** `/rider/parcels`: own assigned parcels, tabs (Pickup / To Deliver /
   Delivered / Failed), call button.
6. **Parcel detail** `/rider/parcels/[id]`: recipient + call + maps link, timeline,
   and **stage actions** — Mark Picked Up; Start Delivery; **Delivered (enter OTP)**;
   **Failed (reason → return)**.

### Phase B — COD & cash
7. **COD store hook:** cash-in-hand = COD of delivered parcels not yet handed over.
8. **Cash page** `/rider/cod`: collected list + **Hand over to hub** →
   `rider-handover-store` (pending) → hub confirms on the branch COD page.
9. **Profile** `/rider/profile`: own details/documents (read-only) + **change
   password** (clears the default).
10. **Verify** after each step: `tsc`, `next lint`, `next build`.

Phase C (proof photo extras, notifications, deep-links) follows once A–B are
proven; the Django backend mirrors the role, scoping, OTP, and COD ledger later.
