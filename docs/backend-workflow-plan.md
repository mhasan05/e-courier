# Courier CMS — Backend Workflow Plan (Django + DRF)

> Status: **Proposal — pending review.** Built to mirror the existing Next.js
> frontend (its mock stores are the API contract). Implemented **module by
> module**; each module is shippable and verified before the next.

---

## 1. Locked Decisions

| # | Decision | Choice |
|---|----------|--------|
| 1 | Views | **`APIView` only** — explicit `get/post/put/patch/delete`. No generics, no `ViewSet`. |
| 2 | Serializers | **`ModelSerializer`** (with custom `validate_*`, `create`, `update` where needed). |
| 3 | Auth | **JWT** via `djangorestframework-simplejwt` (access + refresh). |
| 4 | User model | **Custom user** — email login + `role` field; `Merchant`/`DeliveryMan` link `OneToOne`. |
| 5 | Database | **Neon PostgreSQL** (connection string kept in `.env`, never committed). |

---

## 2. Tech Stack

- Python 3.12, Django 5.x, Django REST Framework
- `djangorestframework-simplejwt` (JWT), `django-cors-headers` (SPA CORS)
- `django-environ` (env/secrets) + `dj-database-url` (Neon URL parsing)
- `psycopg[binary]` (Postgres driver), `Pillow` (image fields)
- Dev/test: `pytest` + `pytest-django`, `httpie`/`curl` for manual checks
- Media: local `MEDIA_ROOT` in dev (swap to S3 later)

---

## 3. Secrets & Database

The Neon connection string is a **secret** — do **not** commit it.

- Create `backend/.env` (git-ignored) holding `DATABASE_URL=postgresql://…neon…?sslmode=require` (the string you provided), `SECRET_KEY`, `DEBUG`, `CORS_ALLOWED_ORIGINS`, JWT lifetimes.
- `settings.py` reads them via `environ.Env()`; `DATABASES['default'] = dj_database_url.parse(env('DATABASE_URL'), conn_max_age=600, ssl_require=True)`.
- Provide a committed `backend/.env.example` with placeholder values.
- `.gitignore`: `.env`, `media/`, `__pycache__/`, `*.sqlite3`.

---

## 4. Project Structure

```
backend/
  manage.py
  requirements.txt
  .env.example
  config/
    settings.py        # env-driven, single file
    urls.py            # /api/v1/ router includes each app's urls
    wsgi.py / asgi.py
  apps/
    common/            # base APIView, permissions, pagination, scoping mixins, responses, OTP, exceptions
    accounts/          # custom user, JWT auth, profile, avatar
    branches/          # hubs + thana coverage + routing
    zones/             # zones + pricing/charge computation
    merchants/
    riders/            # delivery men
    parcels/           # parcels, status events, tracking, recipient stats
    pickups/           # pickup requests
    cod/               # hub remittances + rider handovers
    payments/          # methods, payout methods, withdrawals
    support/           # tickets + messages
    notifications/     # rider notifications
    reports/           # dashboard aggregates
```

---

## 5. Global Conventions (the `common` app — built first)

### 5.1 APIView + ModelSerializer pattern (every endpoint follows this)
```python
class ParcelListView(BaseAPIView):
    permission_classes = [IsAuthenticated, IsMerchantOrAdmin]

    def get(self, request):
        qs = self.scope_parcels(request.user, Parcel.objects.all())
        page = self.paginate(qs, request)
        data = ParcelSerializer(page.object_list, many=True).data
        return self.paginated_response(page, data)

    def post(self, request):
        ser = ParcelCreateSerializer(data=request.data, context={"request": request})
        ser.is_valid(raise_exception=True)
        parcel = ser.save()
        return Response(ParcelSerializer(parcel).data, status=201)
```
- `BaseAPIView(APIView)` in `common`: helpers `paginate()`, `paginated_response()`, `get_object_or_404_scoped()`.
- Detail views implement `get/put/patch/delete`, fetching the object through a **scoped** lookup so a user can't reach another tenant's row.

### 5.2 Pagination — match the frontend `Paginated<T>` shape
```json
{ "results": [...], "count": 123, "page": 1, "pageSize": 20 }
```
A small `Paginator` helper (not DRF's pagination classes, to keep APIView explicit).

### 5.3 Permissions (role-based) in `common/permissions.py`
`IsAdmin`, `IsSuperAdmin`, `IsBranchManager`, `IsMerchant`, `IsRider`, and combos (`IsAdminOrBranchManager`, `IsMerchantOrAdmin`). Plus **object scoping** helpers:
- Merchant → only rows where `merchant == request.user.merchant`.
- Branch manager → only parcels where `owner_branch == request.user.branch` (mirrors `ownerBranchId`).
- Rider → only parcels where `delivery_man == request.user.delivery_man`.
- Admin/super_admin → everything.

### 5.4 Error format & exception handler
Consistent JSON: `{ "detail": "...", "errors": {field: [..]} }` via a custom `EXCEPTION_HANDLER`.

### 5.5 OTP service
`common/otp.py` — generate a 4-digit delivery OTP at booking (stored on the parcel), verified on delivery. (In production a task "sends" it via SMS; for now it's returned to admin/branch like the mock.)

---

## 6. Modules (build order)

> Each module lists **Models → Serializers → Endpoints (APIView) → Permissions →
> Replaces (frontend store) → Acceptance**. Order respects dependencies.

### M0 — Project setup & `common`
- Django project, env settings, Neon connection verified (`manage.py migrate`).
- DRF + SimpleJWT + CORS configured; `BaseAPIView`, paginator, permissions, exception handler, OTP service.
- **Acceptance:** `GET /api/v1/health/` returns 200; DB connects; an admin superuser exists.

### M1 — Accounts & Auth (`accounts`)
- **Models:** `User(AbstractBaseUser, PermissionsMixin)` — `email` (unique, USERNAME_FIELD), `name`, `role` (choices: admin/super_admin/branch_manager/merchant/delivery_man), `is_active`, `branch` (FK, nullable — for branch managers), `avatar` (ImageField). Custom `UserManager`.
- **Serializers:** `UserSerializer`, `LoginSerializer`, `ChangePasswordSerializer`, `AvatarSerializer`.
- **Endpoints (APIView):**
  - `POST /api/v1/auth/login/` → access+refresh + user payload (`role, name, email, branchId, merchantId, deliveryManId`) — mirrors the frontend session.
  - `POST /api/v1/auth/refresh/` (SimpleJWT refresh, wrapped in an APIView).
  - `GET /api/v1/auth/me/` → current user.
  - `POST /api/v1/auth/change-password/`.
  - `PUT /api/v1/auth/avatar/` (multipart) — replaces `avatar-store`.
- **Replaces:** `lib/auth.ts`, `useAuth`, `MOCK_CREDENTIALS`, `avatar-store`.
- **Acceptance:** login as each seeded role returns the right payload + token; protected route rejects anon.

### M2 — Branches / Hubs (`branches`)
- **Models:** `Branch` — `name, code, district, address, phone, coverage_thanas (JSON/array), is_active, created_at`.
- **Serializers:** `BranchSerializer` (+ thana-exclusivity validation in `validate`/`update`).
- **Endpoints:** `GET/POST /branches/`, `GET/PUT/PATCH /branches/{id}/`, `PATCH /branches/{id}/toggle-active/`.
- **Routing helpers:** port `lib/hubs.ts` (`resolveOriginHub`, `resolveDestinationHub`, `nextHopBranchId`, `hubJourney`) into `branches/routing.py` — thana → owning hub, central-hub topology.
- **Permissions:** read for authed staff; write admin/super_admin only.
- **Replaces:** `branch-store`, `lib/hubs.ts`.
- **Acceptance:** create hub, assign coverage, routing resolves origin→central→destination as in the frontend.

### M3 — Zones & Pricing (`zones`)
- **Models:** `Zone` (name, districts[], regular_charge, express_charge, cod_percent…), matching `lib/charges.ts`.
- **Serializers:** `ZoneSerializer`.
- **Endpoints:** `GET/POST /zones/`, `GET/PUT/PATCH/DELETE /zones/{id}/`, `POST /pricing/quote/` → compute delivery/COD/total for a (district, weight, type, codAmount) — server-authoritative charge.
- **Replaces:** `zones` admin page, `lib/charges.ts`, merchant pricing page.
- **Acceptance:** `quote` returns identical numbers to the frontend `computeCharge`.

### M4 — Merchants (`merchants`)
- **Models:** `Merchant` — `OneToOne(user)`, `shop_name, phone, address, district, business_type, status (pending/active/suspended), home_branch (FK), balance, cod_pending, created_at`.
- **Serializers:** `MerchantSerializer`, `MerchantCreateSerializer` (creates the linked user), `MerchantUpdateSerializer`.
- **Endpoints:** `GET/POST /merchants/`, `GET/PUT/PATCH /merchants/{id}/`, `PATCH /merchants/{id}/status/`, `PATCH /merchants/{id}/assign-branch/`. Merchant self: `GET /merchants/me/`.
- **Permissions:** admin manages; merchant reads own.
- **Replaces:** `merchant-store`, `useCurrentMerchant`, admin merchants pages.
- **Acceptance:** merchant ID display, search, branch assignment, status flow all backed by API.

### M5 — Delivery Men / Riders (`riders`)
- **Models:** `DeliveryMan` — `OneToOne(user)`, `phone, nid, passport, photo, nid_image, passport_image, status (active/inactive), branch (FK), created_at`. Password lives on the linked `User`.
- **Serializers:** `DeliveryManSerializer`, `DeliveryManCreateSerializer` (creates user + default password `12345678`), document upload serializer.
- **Endpoints:** `GET/POST /riders/`, `GET/PUT/PATCH /riders/{id}/`, `PATCH /riders/{id}/status/`, document upload (multipart). Rider self: `GET /riders/me/`.
- **Permissions:** admin/branch manage; rider reads own.
- **Replaces:** `deliveryman-store` (incl. `authenticateRider`, `setRiderPassword`).
- **Acceptance:** add rider → can log in (M1) with default password → change password.

### M6 — Parcels (`parcels`) — the core
- **Models:**
  - `Parcel` — recipient fields, `merchant (FK)`, `origin/destination/current/owner_branch (FK)`, `delivery_type, delivery_method, weight, product_description, special_instructions, invoice_number, is_exchange, cod_amount, collected_cod, delivery_charge, cod_charge, total_charge, status, delivery_man (FK), delivery_otp, tracking_id (unique), created_at`.
  - `ParcelStatusEvent` — `parcel (FK), status, remark, changed_by, proof_photo, proof_note, timestamp` (the timeline; replaces embedded `history`).
- **Serializers:** `ParcelSerializer` (nested events), `ParcelCreateSerializer` (computes charges via M3, resolves hubs via M2, generates tracking id + OTP), `ParcelStatusUpdateSerializer`, `AssignDeliveryManSerializer`, `DeliveryProofSerializer`.
- **Endpoints (APIView):**
  - `GET/POST /parcels/` — list is **role-scoped**; create = booking.
  - `GET/PATCH /parcels/{id}/` — scoped detail.
  - `POST /parcels/{id}/status/` — status change + remark (+ proof for delivered/partial; verifies OTP; sets `collected_cod`).
  - `POST /parcels/{id}/assign/` — assign rider (pushes a notification, M11).
  - `POST /parcels/{id}/dispatch/` — next-hop transfer (routing).
  - `GET /parcels/{id}/label/` — label data (frontend renders the Code128 + print).
  - `GET /track/{trackingId}/` — **public**, no auth (customer tracker).
  - `GET /parcels/recipient-stats/?phone=` — success-ratio fraud check.
  - `POST /parcels/import/` — CSV bulk create.
- **Permissions/scoping:** merchant (own), branch (owner_branch), rider (assigned), admin (all). Rider status transitions constrained (pickup/out-for-delivery/delivered+OTP/partial/refund).
- **Replaces:** `parcel-store`, `lib/otp.ts`, `lib/recipient-stats.ts`, tracking page, booking, import.
- **Acceptance:** book → assign → rider delivers with OTP (full & partial) → statuses + COD update; tracking + recipient stats correct; scoping enforced server-side.

### M7 — Pickup Requests (`pickups`)
- Derived view: pending parcels grouped per merchant + pickup address with total COD (mirrors admin/branch pickup-requests). Likely a read APIView aggregating `parcels`, optionally a `PickupRequest` model if you want explicit scheduling later.
- **Endpoints:** `GET /pickups/` (scoped). **Replaces:** pickup-requests pages.

### M8 — COD & Settlement (`cod`)
- **Models:** `HubRemittance` (hub→HQ) and `RiderHandover` (rider→hub) — fields mirror the frontend types (amount, parcel_count, parcel_ids/M2M, reference, status pending/received, timestamps, confirmed_by).
- **Endpoints:** rider handovers `GET/POST /cod/handovers/` + `POST /cod/handovers/{id}/confirm/`; hub remittances `GET/POST /cod/remittances/` + `confirm`. Cash-in-hand computed from delivered-not-handed-over (uses `collected_cod`).
- **Permissions:** rider creates handover; branch confirms; HQ confirms remittance.
- **Replaces:** `rider-handover-store`, `remittance-store`, COD pages.
- **Acceptance:** full chain rider→hub→HQ reconciles; partial COD respected.

### M9 — Payments & Withdrawals (`payments`)
- **Models:** `AvailablePaymentMethod` (admin), `MerchantPayoutMethod`, `WithdrawalRequest` (status pending/approved/paid/rejected).
- **Endpoints:** admin methods CRUD; merchant payout methods CRUD + set-default; withdrawals `GET/POST` + admin `PATCH status`.
- **Replaces:** `payment-store`, payments pages.

### M10 — Support (`support`)
- **Models:** `SupportTicket` (ref, merchant, subject, category, priority, status, tracking_id, unread flags, timestamps), `SupportMessage` (sender, body, attachment image, created_at).
- **Endpoints:** `GET/POST /support/tickets/` (scoped), `GET /support/tickets/{id}/`, `POST /support/tickets/{id}/messages/` (multipart for attachment), `PATCH /support/tickets/{id}/` (status/priority), `POST /support/tickets/{id}/read/`.
- **Replaces:** `support-store`, support pages.

### M11 — Notifications (`notifications`)
- **Models:** `RiderNotification` (rider, type, title, body, parcel, tracking_id, read, created_at). Created by parcel assignment (M6).
- **Endpoints:** `GET /notifications/` (own), `POST /notifications/{id}/read/`, `POST /notifications/read-all/`.
- **Replaces:** `notification-store`. (Real-time push via WebSockets/Channels is a later enhancement; polling first.)

### M12 — Reports / Dashboard (`reports`)
- Read APIViews returning the aggregates the dashboards show (totals, COD pending, delivered today, 7-day volume, status breakdown, open tickets), each **role-scoped**.
- **Replaces:** `lib/analytics.ts`, dashboard tiles/charts.

### M13 — Settings & Media
- Company settings (singleton), logo upload; media serving config. Confirm all image uploads (avatars, rider docs, proof, attachments) accept multipart and return URLs (frontend currently uses data URLs → switch to file inputs + URLs).

---

## 7. Frontend Integration (runs alongside, store by store)

- Add `lib/api.ts` — a `fetch` wrapper that injects the JWT, handles refresh on 401, and base-URLs from `NEXT_PUBLIC_API_URL`.
- Replace each mock store's internals with API calls **as its module lands** — the `useSyncExternalStore` shape and component APIs stay; only the data source changes. Persistence layer (`lib/persist.ts`) is dropped per store once it's server-backed.
- Order mirrors the backend modules (auth → branches → … → reports).

---

## 8. Per-Module Verification (done before moving on)

1. `makemigrations` + `migrate` clean on Neon.
2. Endpoints exercised (pytest + a few `httpie` calls); permission/scoping tests prove a tenant can't read another's data.
3. Wire the matching frontend store; smoke-test the flow end to end.
4. Commit on a feature branch per module.

---

## 9. Suggested Sequence

`M0 → M1 → M2 → M3 → M4 → M5 → M6 → (M7, M8 in parallel) → M9 → M10 → M11 → M12 → M13`

M6 (parcels) is the keystone; M2/M3/M4/M5 must precede it. M8–M12 build on M6.

---

## 10. Open Questions (flag before M0 if relevant)
- **Delivery OTP:** keep the deterministic-from-tracking-ID scheme, or switch to a random stored OTP "sent" via SMS later? (Plan assumes **random stored**, exposed to admin/branch for testing — closer to production.)
- **CORS/hosting:** local dev origins for now; production domains added later.
- **Seed data:** port the frontend JSON seeds into a Django `loaddata` fixture / management command so the API starts with the same demo data?
