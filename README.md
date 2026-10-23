# RideRiteAdmin

Standalone AdminLTE-style control center for RideRite.

- Theme: RideRite mint teal (`#55CDB4`) on obsidian carbon
- Auth: Mongo API admin role (`POST /api/auth/login`) with RBAC admin roles
  (`super_admin`, `ops`, `finance`, `support`); the sidebar and pages follow the role's
  permissions (`GET /api/admin/me`), the API enforces the same. Idle sign-out after
  `VITE_ADMIN_IDLE_MINUTES` (default 15).
- Data: `/api/admin/*` — dashboard (live counters over Socket.IO), users, drivers & KYC, trips &
  disputes, rentals & fleet, finance (revenue, payouts, refunds, subscriptions), bonuses,
  maintenance, cancellations, promos, settings, audit log, health, admins.
- Local QA login: `admin@riderite.test` (seeded by the backend's `seed-test-accounts` scripts).

## Local

```bash
npm install
cp .env.example .env
npm run dev
```

App runs on `http://localhost:5173` (CORS-allowlisted against UAT).

Uses the **same MongoDB** as the rider web app via `VITE_API_URL` → RideRite backend login/admin APIs. Sign in with your existing Mongo `role: "admin"` account.

## Deploy

Build static assets and host behind your UAT admin URL:

```bash
npm run build
# upload dist/ to your admin host
```

`VITE_API_URL` is required — without it the panel shows a configuration error instead of
guessing a backend:

```
VITE_API_URL=https://riderite-backend.deployment-uat.com
```

## Note

This panel is separate from the rider/driver web app. The main Ride-Rite site no longer exposes `/admin`.
