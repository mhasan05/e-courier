# Frontend ↔ Django API Integration Plan

> Swap the Next.js app from its in-memory mock stores to the real Django API,
> **store by store**, mirroring the backend module order. The mock layer stays as
> a fallback while `NEXT_PUBLIC_API_URL` is unset, so the app never breaks mid-migration.

## Foundation (done)

- `lib/api.ts` — authenticated fetch client: JWT access/refresh in localStorage,
  transparent refresh-and-retry on 401, JSON + `FormData`, `ApiError`. No-ops to
  mock when `NEXT_PUBLIC_API_URL` is unset (`apiEnabled()`).
- `lib/api/auth.ts` — `login` (email **or phone**), `me`, `changePassword`.
- `lib/api/ws.ts` — `notificationsSocket()`, `ticketSocket(id)` (JWT via `?token=`).
- `.env.local.example` — `NEXT_PUBLIC_API_URL=http://localhost:8000/api/v1`.

## Cutover order (one slice per step, each verified)

| # | Slice | Frontend touch points | Backend |
|---|-------|----------------------|---------|
| 1 | **Auth** | login page → `login()`; `useAuth` reads JWT + `/auth/me`; logout clears tokens; avatar upload | M1 |
| 2 | **Branches / Zones / Pricing** | `branch-store`, `lib/hubs`, `lib/charges`, zone admin, pricing quote | M2–M3 |
| 3 | **Merchants** | `merchant-store`, `useCurrentMerchant` → `/merchants/me`, admin merchant pages | M4 |
| 4 | **Riders** | `deliveryman-store`, rider profile/me, documents upload | M5 |
| 5 | **Parcels** | `parcel-store` → list/detail/book/status/assign/dispatch; tracking; recipient-stats; import | M6 |
| 6 | **Pickups** | pickup-requests pages → `/pickups/` | M7 |
| 7 | **COD** | `rider-handover-store`, `remittance-store` → `/cod/*` | M8 |
| 8 | **Payments** | `payment-store` → `/payment-methods`, `/payout-methods`, `/withdrawals` | M9 |
| 9 | **Support** | `support-store` → `/support/tickets`; **`ticketSocket` for live messages** | M10 |
| 10 | **Notifications** | `notification-store` → `/notifications`; **`notificationsSocket` for live pushes** | M11 |
| 11 | **Reports** | dashboards → `/reports/dashboard/` | M12 |

## Per-store pattern

Each mock store currently exposes a reactive `useX()` (via `useSyncExternalStore`)
plus mutators. Migrate by replacing internals while keeping the hook names:

1. On first `useX()` mount, fetch from the API into the module cache, then `emit()`.
2. Mutators call the API (`apiPost`/`apiPatch`/…) then refetch or patch the cache.
3. Drop `lib/persist.ts` usage for that store (server is now the source of truth).
4. Replace data-URL image inputs with multipart uploads to the API; render returned URLs.
5. For Support + Notifications, open the WebSocket on mount and merge pushed events
   into the cache for live updates; close on unmount.

## Running both locally

```bash
# terminal 1 — API (HTTP + WS)
cd backend && .venv/Scripts/python manage.py runserver
# terminal 2 — frontend
cd frontend && cp .env.local.example .env.local && npm run dev
```

CORS is already allow-listed for `localhost:3000` in the backend settings.

## Demo logins (DB-backed)

`admin@cms.com / admin123` · `merchant@cms.com / merchant123` ·
`branch@cms.com / branch123` · rider `jamal.rider@cms.com` **or** phone
`01911000201` / `12345678`.
