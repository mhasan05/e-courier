# Multi-Branch (Hub) System — Design & Implementation Plan

> Status: **Proposal — pending decisions.** No code is written until the "Open
> Decisions" section is signed off.
> Scope: Courier Management System (CMS). Frontend is live (Next.js, mock data).
> Backend (Django) is not yet built, so this plan shapes **both** the mock
> frontend and the future backend schema.

---

## 1. Goal

Turn the current single-operation CMS into a **multi-branch courier network**
where every **branch = a hub**. Parcels are picked up at one hub's area,
moved between hubs when needed, and delivered from the hub that serves the
recipient's area. Head Office (HQ) oversees all hubs; each hub operates and
reports on its own work.

This mirrors how Bangladeshi couriers (Pathao, Steadfast, RedX, etc.) actually
run: **hub-and-spoke** logistics.

---

## 2. Core Concepts & Terminology

| Term | Meaning |
|------|---------|
| **HQ / Head Office** | The top-level operator. Sees and configures everything. (today's "Admin") |
| **Branch / Hub** | A physical operating location that covers a set of areas (districts/thanas). Picks up, sorts, transfers, and delivers parcels. |
| **Coverage area** | The districts (and optionally thanas) a hub is responsible for delivering to. |
| **Origin hub** | The hub that collects a parcel from the merchant (based on the merchant's pickup area). |
| **Destination hub** | The hub that serves the recipient's area and makes the final delivery. |
| **Local delivery** | Origin hub = destination hub (no transfer). |
| **Inter-hub transfer (line-haul)** | Moving a parcel from origin hub → destination hub. |
| **Branch Manager** | Runs one hub. Scoped to that hub's data only. |

---

## 3. How It Works — Parcel Flow

```
Merchant books a parcel
        │
        ▼
[Origin Hub]  ── rider picks up from merchant ──►  received & sorted at origin hub
        │
        ├─ recipient is in the SAME hub's area  ──►  Out for delivery ──► Delivered (LOCAL)
        │
        └─ recipient is in ANOTHER hub's area
                 │
                 ▼
        In transit (line-haul)  ──►  [Destination Hub] received & sorted
                 │
                 ▼
        Out for delivery (destination rider) ──► Delivered
```

**Returns** travel the reverse path (destination hub → origin hub → merchant).

### Hub resolution
- **Origin hub** = the merchant's assigned **home hub** (set from the merchant's
  pickup address area).
- **Destination hub** = resolved from the **recipient's district** (and optionally
  thana) via a hub→coverage map.
- If origin == destination → local; else → transfer.

### Topology options (DECISION 1)
- **A. Point-to-point (recommended for MVP):** any hub can transfer directly to
  any other hub. Simple, no central dependency.
- **B. Central sorting hub:** origin → central hub → destination. Realistic at
  scale, adds a routing layer. Can be added later without breaking A.

---

## 4. Roles & Permissions

| Role | Scope | Capabilities |
|------|-------|--------------|
| **Super Admin (HQ)** | All branches | Manage branches, zones, payment methods, global config; consolidated reports; can act on any hub's data; approve withdrawals; settle COD. |
| **Branch Manager** | One branch | Manage that hub's pickups, parcels at the hub, hub's delivery men, hub COD, hub reports. Cannot see other hubs or global config. |
| **Branch Operator (optional)** | One branch | Day-to-day desk: scan parcels in/out, assign riders, update statuses. No financial actions. |
| **Merchant** | Self | Unchanged. Books parcels, tracks, withdraws. Tied to a **home hub** (for pickups). Sees their parcels across all hubs. |
| **Delivery Man** | One branch | Hub-scoped delivery tasks (future mobile app). |

**Branch Manager modeling (DECISION 3):**
- **A.** A distinct login role with its own (scoped) panel.
- **B.** Reuse the existing Admin panel but **scope all data to one branch** when
  the logged-in admin belongs to a branch (HQ admin = no branch = sees all).
Recommended: **B** for speed now, with the data model ready for A later.

---

## 5. Data Model Extensions

### New entity: `Branch` (Hub)
```
Branch {
  id
  name                 // "Dhaka Central Hub"
  code                 // "DHK-01"  (used in tracking & labels)
  type                 // "hub" | "sub_hub"          (future: central vs spoke)
  phone
  address
  district
  thana
  coverageDistricts    // string[]  — districts this hub delivers to
  // (optional) coverageThanas: string[] for finer routing
  managerUserId        // FK User (branch manager)
  isActive
  createdAt
}
```

### Changes to existing entities
| Entity | New field(s) | Purpose |
|--------|-------------|---------|
| **User** | `branchId?` | Null for HQ/Super Admin; set for branch staff. Drives data scoping. |
| **Merchant** | `homeBranchId` | Origin hub for pickups. |
| **Parcel** | `originBranchId`, `destinationBranchId`, `currentBranchId` | Routing + "where is it now". |
| **DeliveryMan** | `branchId` | Rider belongs to a hub. |
| **ParcelStatusLog** | `branchId?` | Which hub performed the scan/event. |
| **CODDisbursement / COD ledger** | `collectedBranchId` | Hub that collected the cash (for reconciliation). |
| **Zone** | (link) `branchId?` or keep zones independent | See §7. |

### Hub coverage → routing
A single source of truth maps **district → hub**. Two ways to store it:
- On the hub: `coverageDistricts: string[]` (recommended — easy hub admin UI).
- Derived map `districtToBranch` built from all hubs at runtime.

Resolution helper (mirrors today's `findZoneByDistrict`):
```
resolveDestinationHub(recipientDistrict) -> Branch
resolveOriginHub(merchant) -> merchant.homeBranch
```

---

## 6. Parcel Lifecycle With Hubs

Current statuses: `pending, picked_up, in_transit, out_for_delivery,
delivered, partially_delivered, return_in_transit, returned, cancelled`.

These already cover most of the flow. To make the **hub journey** explicit we
add hub context to each event and (optionally) two statuses:

| Stage | Status (proposal) | Hub recorded |
|-------|-------------------|--------------|
| Booked | `pending` | origin |
| Rider collects from merchant | `picked_up` | origin |
| Scanned in at origin hub | **`at_hub`** (new) or reuse `picked_up` + log | origin |
| Moving between hubs | `in_transit` | — (line-haul) |
| Scanned in at destination hub | **`at_hub`** (new) or `in_transit` + log | destination |
| Rider out for delivery | `out_for_delivery` | destination |
| Delivered | `delivered` | destination |

**DECISION 4 — status granularity:**
- **A.** Keep the 9 statuses; record the hub on each `ParcelStatusLog` event
  (less churn, fewer enum changes).
- **B.** Add `at_hub` (and maybe `received_at_destination_hub`) for clearer
  customer tracking.
Recommended: **A** now (log-driven), upgrade to B if customers need hub-level
granularity on the tracking page.

The public tracker shows the hub journey, e.g.:
`Origin: Dhaka Central → In transit → Destination: Sylhet Hub → Out for delivery → Delivered`.

---

## 7. Zones vs Hubs

Today **Zones** drive **pricing** (per destination district). Hubs drive
**operations/routing**. They are related but distinct:
- Keep **Zones = pricing** (unchanged: charge by destination zone).
- Add **Hubs = routing/coverage** (which hub delivers to a district).

A district therefore has both a **zone** (price) and a **hub** (operations).
They can be configured independently. (Optionally a hub can "own" zones later,
but decoupling now keeps pricing stable.)

---

## 8. Feature Changes by Module

### 8.1 Branch Management (HQ only) — NEW
- `/admin/branches` — list, add, edit, activate/deactivate hubs.
- Fields: name, code, phone, address, district/thana, **coverage districts**
  (multi-select from the 64), assign a Branch Manager.
- Guardrails: warn on **uncovered districts** (no hub) and **overlaps** (two hubs
  claiming the same district).

### 8.2 Merchant onboarding
- On approval (or registration), assign a **home hub** — auto-suggested from the
  merchant's pickup district, manually overridable by HQ.

### 8.3 Pickup Requests (already built) → hub-scoped
- HQ: all pending pickups grouped by merchant (today's page), **plus a hub
  filter / hub column**.
- Branch Manager: only pickups for merchants whose **home hub = their branch**.

### 8.4 Parcels & routing
- On booking/import, auto-set `originBranchId` (merchant home hub) and
  `destinationBranchId` (recipient district → hub), `currentBranchId = origin`.
- Branch Manager parcel list shows parcels **currently at / handled by their hub**.
- New **Transfer** action: dispatch a batch from current hub → next hub
  (sets `in_transit`, updates `currentBranchId` on arrival scan).

### 8.5 Delivery men → hub-scoped
- Each rider has `branchId`. Assignment dropdown on a parcel only shows riders of
  the parcel's **current** hub.

### 8.6 COD & settlement
- COD is collected by the **destination hub** rider at delivery.
- Ledger: hub-level "COD collected" → remitted to HQ → HQ disburses to merchant
  (existing COD/Payments flow stays at HQ level).
- Add `collectedBranchId` for reconciliation and per-hub COD reports.
- Merchant's withdrawable balance logic is unchanged (HQ owes the merchant).

### 8.7 Payments / Withdrawals (already built)
- Withdrawals remain **HQ-level** (merchant → HQ). No change needed for MVP,
  except optional per-hub visibility.

### 8.8 Reports
- Branch Manager: their hub's parcels, success rate, COD, rider performance.
- HQ: **consolidated** + **per-hub comparison** (volume, success %, COD,
  transfer times).

### 8.9 Public tracking
- Show the hub journey + current hub, keeping the live map.

---

## 9. Data Scoping (the critical rule)

Every list/query is filtered by the **viewer's branch**:
- **HQ (no branch):** no filter — sees everything; optional **branch switcher**
  to focus on one hub.
- **Branch staff (has branch):** hard filter to their `branchId` on parcels
  (by current/origin/destination per page), pickups, delivery men, COD.

Frontend: a single `useBranchScope()` returning `{ branchId | null }` that every
page applies. Backend (later): enforce in querysets + permission classes
(`IsBranchScoped`).

---

## 10. Frontend Architecture (mock phase)

- **New mock data:** `branches.json`; add `branchId`/`homeBranchId`/
  `originBranchId`/`destinationBranchId` to seeds.
- **New store:** `branch-store.ts` (useSyncExternalStore, like the others).
- **Routing helper:** `lib/hubs.ts` → `resolveDestinationHub`, `resolveOriginHub`,
  `districtToBranch`.
- **Branch context:** `useBranchScope()` (reads role + branch from session;
  HQ can pick a branch via a topbar **Branch Switcher**).
- **Nav per role:** HQ vs Branch Manager menus (extend `ADMIN_NAV` into
  role-aware sets, or add `BRANCH_NAV`).
- Update `parcel-store` selectors to expose branch-aware filters.
- The existing Role type already includes `super_admin`; introduce a
  `branch_manager` role (or scope existing admin) per Decision 3.

---

## 11. Phased Roadmap

| Phase | Deliverable | Notes |
|-------|-------------|-------|
| **0. Decisions** | Sign off this doc's decisions | Blocking. |
| **1. Foundation** | `Branch` entity + HQ **Branches** page; assign merchants & riders to hubs; auto-set parcel origin/destination hub on booking/import; hub shown on parcel/pickup pages | No behavior change to flows yet; data becomes hub-aware. |
| **2. Scoping & roles** | Branch context + branch switcher; Branch Manager scoped views (pickups, parcels, delivery men, COD, reports) | Branch managers can operate their hub. |
| **3. Transfers** | Inter-hub transfer action + `currentBranchId` movement + hub journey on tracking (+ optional `at_hub` status) | Real hub-and-spoke movement. |
| **4. Financials** | Per-hub COD ledger + remittance to HQ + consolidated/per-hub reports | Reconciliation. |
| **5. Backend** | Django models & permissions mirroring this plan | Done alongside the M4–M9 backend build. |

Each phase is shippable and reversible; we verify (tsc/lint/build) after each.

---

## 12. Decisions — LOCKED ✅

| # | Decision | Chosen | Implication |
|---|----------|--------|-------------|
| 1 | Topology | **Central sorting hub** | Routing is origin hub → **central hub** → destination hub. One hub is flagged `type: "central"`. Local delivery still skips the line-haul when origin = destination. |
| 2 | Routing granularity | **By thana** | Hubs own **thanas** (not whole districts). Coverage config is thana-level (grouped by district). Every thana must map to exactly one hub. |
| 3 | Branch Manager | **Separate role + panel** | New `branch_manager` role, its own login + dedicated `/branch/*` panel and nav. New demo account in mock auth. |
| 4 | MVP scope | **Phases 1–2** | Build foundation + scoping/roles now (working multi-hub operation). Transfers/financials/backend are later phases. |
| 5 | Status granularity | **Log-driven (default)** | Keep the 9 statuses; record `branchId`/event on each `ParcelStatusLog`. Revisit `at_hub` status in Phase 3. |
| 6 | COD model | **Collect at delivery hub → remit to HQ → HQ pays merchant (default)** | Add `collectedBranchId` for reconciliation. No per-hub commission for now. |

> Decisions 5 & 6 use the recommended defaults (not separately asked). Flag if
> you want them changed.

### Implications to be aware of
- **Thana coverage data is large** (~490 thanas). For the mock we seed a
  thana→hub map; in the UI, hub coverage is a thana multi-select grouped by
  district, with **gap/overlap validation** (every thana mapped once).
- **A central hub must be designated** (e.g., "Dhaka Central Hub"). All inter-hub
  transfers route through it in Phase 3.
- **Separate branch panel** = a new route group `app/(branch)/branch/*`, a
  branch-manager layout/nav, and a mock `branch@cms.com` login.

---

## 13. Risks & Considerations

- **Coverage gaps/overlaps:** a district with no hub (parcel can't route) or two
  hubs claiming it. Mitigation: validation + a default/fallback hub.
- **Data migration:** existing parcels/merchants need a hub backfilled. In mock
  we seed it; in backend we'll write a migration assigning by district.
- **Scoping bugs = data leaks:** a branch seeing another branch's data. Mitigation:
  one central scope helper + tests; enforce server-side later.
- **Pricing unchanged:** keep zones decoupled so multi-hub doesn't disturb
  charges.
- **Complexity creep:** ship Phase 1 first; don't build transfers/financials
  until foundation is proven.

---

## 14. Build Plan — Phases 1 & 2 (locked path)

### Phase 1 — Foundation (hub-aware data, no scoping yet)
1. **Types:** `Branch` (with `type: "central" | "hub"`, `coverageThanas: string[]`,
   `managerUserId`); add `homeBranchId` to Merchant, `originBranchId` /
   `destinationBranchId` / `currentBranchId` to Parcel, `branchId` to DeliveryMan,
   `branchId` to the auth session/User.
2. **Mock data:** `branches.json` (e.g., 4–5 hubs incl. one central);
   `thana-hub.json` map (every thana → a hub); backfill seeds
   (`merchant.homeBranchId`, parcel origin/destination/current, rider `branchId`).
3. **Stores/helpers:** `branch-store.ts`; `lib/hubs.ts` with
   `resolveDestinationHub(thana)`, `resolveOriginHub(merchant)`, `centralHub()`.
4. **HQ Branches admin page** `/admin/branches`: list + add/edit/activate;
   thana coverage multi-select (grouped by district) with **gap/overlap
   validation**; assign manager; mark central.
5. **Wire routing into booking + import:** set origin/destination/current hub on
   every new parcel.
6. **Show hub** on admin parcel detail, pickup requests, delivery-man assignment
   (rider list filtered to parcel's current hub).

### Phase 2 — Roles & scoping (branch manager panel)
7. **Role + auth:** add `branch_manager` role; mock `branch@cms.com` login bound
   to a branch; route guard for `/branch/*`.
8. **Branch panel:** `app/(branch)/branch/*` with its own layout/sidebar
   (`BRANCH_NAV`): Dashboard, Pickup Requests, Parcels, Delivery Men, COD,
   Reports — all hard-scoped to the manager's `branchId`.
9. **Scope helper:** `useBranchScope()` applied across branch pages (and HQ
   branch switcher for focusing one hub).
10. **Verify** after each step: `tsc`, `next lint`, `next build`.

Transfers (Phase 3), per-hub COD reconciliation (Phase 4), and the Django
backend (Phase 5) follow once 1–2 are proven.
