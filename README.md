# RideRiteAdmin

Standalone AdminLTE-style control center for RideRite.

- Theme: RideRite mint teal (`#55CDB4`) on obsidian carbon
- Auth: Mongo API admin role (`POST /api/auth/login`)
- Data: `/api/admin/analytics|users|drivers|trips`

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

Set `VITE_API_URL` to the backend you want (default UAT):

```
VITE_API_URL=https://riderite-backend.deployment-uat.com
```

## Note

This panel is separate from the rider/driver web app. The main Ride-Rite site no longer exposes `/admin`.
