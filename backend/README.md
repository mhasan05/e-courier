# Courier CMS — Backend (Django + DRF)

API for the Courier CMS. Plain `APIView` + `ModelSerializer`, JWT auth (SimpleJWT),
custom email+role user, PostgreSQL (Neon). See `docs/backend-workflow-plan.md` for
the module roadmap.

## Setup

```bash
cd backend
python -m venv .venv
.venv/Scripts/python -m pip install -r requirements.txt   # Windows
cp .env.example .env        # then fill in DATABASE_URL, SECRET_KEY, ...
.venv/Scripts/python manage.py migrate
.venv/Scripts/python manage.py createsuperuser --noinput   # with DJANGO_SUPERUSER_* env vars
.venv/Scripts/python manage.py runserver
```

`.env` holds secrets (DB URL, secret key) and is git-ignored — never commit it.

## Conventions

- **Views:** subclass `apps.common.views.BaseAPIView` (an `APIView`); implement
  `get/post/put/patch/delete`. No generics or viewsets.
- **Serializers:** `ModelSerializer` with custom `validate_*` / `create` / `update`.
- **Pagination:** `self.paginate(qs, request)` + `self.paginated_response(page, data)`
  → `{ results, count, page, pageSize }`.
- **Permissions:** role classes in `apps.common.permissions`
  (`IsAdmin`, `IsMerchant`, `IsRider`, ...). Scope objects per role in each view.
- **Errors:** normalized to `{ "detail": str, "errors": {} }`.

## Real-time (WebSockets)

Channels + Daphne (ASGI). `runserver` serves both HTTP and WS. In-memory channel
layer for dev — swap to `channels_redis` for production/multi-process. Authenticate
with a JWT access token in the query string (browsers can't set WS headers):

| WS path | Who | Pushes |
|---------|-----|--------|
| `ws/notifications/?token=<JWT>` | rider | new parcel-assignment notifications |
| `ws/support/<ticketId>/?token=<JWT>` | ticket's merchant or admin | new ticket messages |

REST mutations (`assign`, ticket `messages`) also broadcast over these sockets, so
the UI updates live while the persisted record remains the source of truth.

## Modules

All under `/api/v1/`: `auth/`, `branches/`, `zones/` + `pricing/quote/`,
`merchants/`, `riders/`, `parcels/` (+ `track/`, `recipient-stats/`, `import/`),
`pickups/`, `cod/`, `payment-methods/` + `payout-methods/` + `withdrawals/`,
`support/tickets/`, `notifications/`, `reports/dashboard/`, and `health/`.

Seed everything from the frontend mock data:
```bash
python manage.py seed_branches && python manage.py seed_zones \
  && python manage.py seed_merchants && python manage.py seed_riders \
  && python manage.py seed_staff && python manage.py seed_parcels \
  && python manage.py seed_cod && python manage.py seed_payments \
  && python manage.py seed_support
```
