import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getUser,
  setSession,
  setUser,
  type AdminRole,
  type AdminUser,
} from "./session";

/**
 * Backend base URL. Required: there is deliberately no fallback, so a build without
 * VITE_API_URL shows a configuration error instead of quietly talking to another environment.
 */
export function getApiBaseUrl(): string | null {
  const raw = (import.meta.env.VITE_API_URL as string | undefined)?.trim();
  return raw ? raw.replace(/\/$/, "") : null;
}

function baseUrl() {
  const url = getApiBaseUrl();
  if (!url) throw new ApiError(0, "VITE_API_URL is not configured");
  return url;
}

export class ApiError extends Error {
  status: number;
  code?: string;
  constructor(status: number, message: string, code?: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
  }
}

export const errorMessage = (e: unknown, fallback = "Something went wrong") =>
  e instanceof ApiError ? e.message : e instanceof Error ? e.message : fallback;

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

function forceLoginRedirect(reason?: string) {
  clearSession();
  if (typeof window === "undefined") return;
  const path = window.location.pathname || "";
  if (path.startsWith("/login")) return;
  window.location.replace(reason ? `/login?reason=${encodeURIComponent(reason)}` : "/login");
}

function toAdminUser(u: Record<string, any>): AdminUser {
  return {
    id: u.id,
    email: u.email,
    fullName: u.fullName ?? null,
    role: u.role,
    phone: u.phone ?? null,
    adminRole: u.adminRole,
    permissions: Array.isArray(u.permissions) ? u.permissions : [],
  };
}

/**
 * Single-flight refresh: the backend rotates refresh tokens, so parallel 401s must share one
 * refresh call — a second refresh with the already-rotated token would fail and sign out.
 */
let refreshing: Promise<boolean> | null = null;

function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = doRefresh().finally(() => {
      refreshing = null;
    });
  }
  return refreshing;
}

async function doRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${baseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.accessToken || !data?.refreshToken || data?.user?.role !== "admin") return false;
    setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, toAdminUser(data.user));
    window.dispatchEvent(new Event("rr-admin-token"));
    return true;
  } catch {
    return false;
  }
}

async function authedFetch(path: string, init: RequestInit = {}, skipRefresh = false): Promise<Response> {
  const send = () => {
    const headers = new Headers(init.headers);
    const token = getAccessToken();
    if (token) headers.set("Authorization", `Bearer ${token}`);
    return fetch(`${baseUrl()}${path}`, { ...init, headers });
  };
  let res = await send();
  if (res.status === 401 && !skipRefresh) {
    if (await refreshSession()) res = await send();
    else {
      forceLoginRedirect("expired");
      throw new ApiError(401, "Session expired. Please sign in again.");
    }
  }
  return res;
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, skipRefresh = false } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  const init: RequestInit = { method, headers, body: body === undefined ? undefined : JSON.stringify(body) };
  const res = auth ? await authedFetch(path, init, skipRefresh) : await fetch(`${baseUrl()}${path}`, init);
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    if (auth && res.status === 401) forceLoginRedirect("expired");
    const message = data.error || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data.code || data.details?.code);
  }
  return data as T;
}

/** Authenticated file download (CSV / XLSX / JSON) saved under the server's filename. */
export async function downloadFile(path: string, fallbackName: string) {
  const res = await authedFetch(path);
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new ApiError(res.status, data.error || "Download failed");
  }
  const disposition = res.headers.get("Content-Disposition") || "";
  const name = /filename="?([^";]+)"?/i.exec(disposition)?.[1] || fallbackName;
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}

export async function uploadPhotos(files: File[]): Promise<string[]> {
  const form = new FormData();
  for (const f of files) form.append("photos", f);
  const res = await authedFetch("/api/uploads/photos", { method: "POST", body: form });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, data.error || "Upload failed");
  return (data.files || []).map((f: { url: string }) => f.url);
}

export async function loginAdmin(email: string, password: string) {
  const data = await apiRequest<{ accessToken: string; refreshToken: string; user: Record<string, any> }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });
  const user = toAdminUser(data.user);
  if (user.role !== "admin") {
    // Not an admin: drop the session the API just opened
    void fetch(`${baseUrl()}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${data.accessToken}` },
      body: JSON.stringify({ refreshToken: data.refreshToken }),
    }).catch(() => {});
    throw new ApiError(403, "Admin access only");
  }
  setSession({ accessToken: data.accessToken, refreshToken: data.refreshToken }, user);
  return user;
}

/** Revokes the refresh token on the server, then clears local state. */
export async function logoutAdmin(reason?: "idle") {
  const refreshToken = getRefreshToken();
  const token = getAccessToken();
  const url = getApiBaseUrl();
  clearSession();
  if (!url || !refreshToken) return;
  try {
    await fetch(`${url}/api/auth/logout`, {
      method: "POST",
      headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ refreshToken, reason }),
      keepalive: true,
    });
  } catch {
    /* already signed out locally */
  }
}

/** Re-read role / permissions (e.g. after a super admin changed this admin's role). */
export async function refreshMe() {
  const data = await apiRequest<{ user: Record<string, any> }>("/api/admin/me", { auth: true });
  const user = toAdminUser(data.user);
  setUser(user);
  return user;
}

// ----------------------------------------------------------------------------- types

export type Paged<T> = { ok: true; page: number; limit: number; total: number; totalPages: number } & T;
export type Brief = { id: string; fullName: string | null; email: string | null; phone?: string | null } | null;
type Params = Record<string, string | number | boolean | undefined | null>;

export function toQuery(params: Params = {}) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "" || value === "all") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export type PlatformUser = {
  id: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  role: "rider" | "driver" | "admin";
  isActive: boolean;
  status: "active" | "suspended" | "deactivated" | "deleted" | "inactive";
  suspension: { status: string; reason: string; at: string } | null;
  isEmailVerified: boolean;
  createdAt: string;
  lastLoginAt: string | null;
};

export type DocumentInfo = {
  label: string;
  files: Record<string, string | null>;
  expiresOn: string | null;
  daysLeft: number | null;
  expired: boolean;
  status: "missing" | "pending" | "approved" | "rejected";
  reviewedAt: string | null;
  note: string;
};

export type PlatformDriver = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  isActive: boolean | null;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehiclePlate: string;
  verificationStatus: string;
  isApproved: boolean;
  isOnline: boolean;
  status: "pending" | "incomplete" | "approved" | "rejected" | "suspended" | "deactivated";
  reviewDecision: { status: string; reason: string; at: string } | null;
  createdAt: string;
  verificationSubmittedAt: string | null;
  documents: Record<"license" | "registration" | "insurance", DocumentInfo>;
  documentsPending: number;
  pendingVehicleChange: Record<string, any> | null;
};

export type PlatformTrip = {
  id: string;
  status: string;
  pickupAddress: string;
  destinationAddress: string;
  vehicleType: string;
  paymentMethod: string;
  paid: boolean;
  paymentStatus: string;
  fareCents: number;
  refundCents: number;
  rider: Brief;
  driver: Brief;
  disputed: boolean;
  createdAt: string;
};

export type LiveCounters = {
  activeTrips: number;
  searching: number;
  activeRentals: number;
  activeChauffeur: number;
  onlineDrivers: number;
  at: string;
};

export type Revenue = Record<string, number | null> & { platformRevenueCents: number };

export type Analytics = {
  days: number;
  totalTrips: number;
  completed: number;
  cancelled: number;
  tripsInPeriod: number;
  users: { riders: number; drivers: number; total: number; suspended: number; newInPeriod: number };
  driverCounts: { approved: number; pending: number };
  live: LiveCounters;
  revenue: { allTime: Revenue; period: Revenue };
  payables: { pendingCents: number; pendingDrivers: number; processingCents: number };
  subscriptions: SubscriptionOverview;
  trends: { date: string; trips: number; completed: number; cancelled: number; collectedCents: number; signups: number }[];
  queues: Record<string, number>;
};

export type SubscriptionOverview = {
  active: number;
  pastDue: number;
  canceled: number;
  expired: number;
  incomplete: number;
  byPlan: Record<string, number>;
  mrrCents: number;
};

export type Settings = {
  fares: Record<"sedan" | "suv" | "truck", { baseCents: number; perMileCents: number; perMinuteCents: number }> & {
    bookingFeeCents: number;
    minimumFareCents: number;
    serviceFeeRate: number;
    taxRate: number;
  };
  cancellation: { feeCents: number; graceSeconds: number };
  commission: { platformRate: number; rentalRate: number; chauffeurRate: number };
  chauffeurHourlyCents: Record<"sedan" | "suv" | "truck", number>;
  bonus: { minTrips: number; minOnTimeRate: number; minSafeScore: number; onTimeGraceMinutes: number; amountCents: number };
  dispatch: { offerSeconds: number };
};

export type AdminAccount = {
  id: string;
  fullName: string;
  email: string | null;
  adminRole: AdminRole;
  isActive: boolean;
  lastLoginAt: string | null;
  createdAt: string;
};

const get = <T>(path: string, params?: Params) => apiRequest<T>(`${path}${toQuery(params)}`, { auth: true });
const send = <T>(method: string, path: string, body?: unknown) => apiRequest<T>(path, { method, auth: true, body });

// ----------------------------------------------------------------------------- endpoints

export const adminApi = {
  analytics: (days = 7) => get<{ ok: true } & Analytics>("/api/admin/analytics", { days }),

  users: (p: Params) => get<Paged<{ users: PlatformUser[] }>>("/api/admin/users", p),
  user: (id: string) => get<any>(`/api/admin/users/${id}`),
  setUserRole: (id: string, role: "rider" | "driver") => send<any>("PATCH", `/api/admin/users/${id}/role`, { role }),
  setUserStatus: (id: string, action: "suspend" | "deactivate" | "reactivate", reason = "") =>
    send<{ user: PlatformUser }>("PATCH", `/api/admin/users/${id}/status`, { action, reason }),
  gdprDelete: (id: string, reason: string) => send<any>("DELETE", `/api/admin/users/${id}`, { reason }),
  gdprExport: (id: string) => downloadFile(`/api/admin/users/${id}/gdpr-export`, `user-${id}.json`),
  exportUsers: (format: "csv" | "xlsx", p: Params) => downloadFile(`/api/admin/export/users.${format}${toQuery(p)}`, `users.${format}`),

  drivers: (p: Params) => get<Paged<{ drivers: PlatformDriver[] }>>("/api/admin/drivers", p),
  driver: (userId: string) => get<any>(`/api/admin/drivers/${userId}`),
  setDriverStatus: (userId: string, status: string, reason?: string | null) =>
    send<any>("PATCH", `/api/admin/drivers/${userId}/status`, { status, reason: reason ?? "" }),
  reviewDocument: (userId: string, doc: string, status: "approved" | "rejected", note = "") =>
    send<any>("PATCH", `/api/admin/drivers/${userId}/documents/${doc}`, { status, note }),
  reviewVehicleChange: (userId: string, action: "approve" | "reject", note = "") =>
    send<any>("PATCH", `/api/admin/drivers/${userId}/vehicle-change`, { action, note }),
  exportDrivers: (format: "csv" | "xlsx", p: Params) => downloadFile(`/api/admin/export/drivers.${format}${toQuery(p)}`, `drivers.${format}`),

  trips: (p: Params) => get<Paged<{ trips: PlatformTrip[] }>>("/api/admin/trips", p),
  trip: (id: string) => get<any>(`/api/admin/trips/${id}`),
  tripChat: (id: string) => get<{ messages: any[] }>(`/api/admin/trips/${id}/chat`),
  refundTrip: (id: string, refundCents: number, reason: string) => send<any>("PATCH", `/api/admin/trips/${id}/refund`, { refundCents, reason }),

  disputes: (p: Params) => get<Paged<{ disputes: any[] }>>("/api/admin/disputes", p),
  updateDispute: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/disputes/${id}`, body),

  rentalListings: (p: Params) => get<Paged<{ listings: any[] }>>("/api/admin/rentals/listings", p),
  updateRentalListing: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/rentals/listings/${id}`, body),
  createFleet: (body: Record<string, unknown>) => send<any>("POST", "/api/admin/rentals/fleet", body),
  updateFleet: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/rentals/fleet/${id}`, body),
  deleteFleet: (id: string) => send<any>("DELETE", `/api/admin/rentals/fleet/${id}`),
  rentalBookings: (p: Params) => get<Paged<{ bookings: any[]; totals: Record<string, any> }>>("/api/admin/rentals/bookings", p),
  chauffeur: (p: Params) => get<Paged<{ bookings: any[] }>>("/api/admin/chauffeur", p),

  revenue: (p: Params) => get<any>("/api/admin/revenue", p),
  payouts: (p: Params) => get<Paged<{ payouts: any[]; pendingCents: number; pendingDrivers: number }>>("/api/admin/payouts", p),
  payoutBalances: (p: Params) => get<Paged<{ balances: any[] }>>("/api/admin/payouts/balances", p),
  runPayouts: (driverId?: string) => send<{ results: any[] }>("POST", "/api/admin/payouts/run", driverId ? { driverId } : {}),
  payments: (p: Params) => get<Paged<{ payments: any[] }>>("/api/admin/payments", p),
  refunds: (p: Params) => get<Paged<{ refunds: any[] }>>("/api/admin/refunds", p),
  manualRefund: (paymentId: string, amountCents: number, reason: string) =>
    send<any>("POST", "/api/admin/refunds", { paymentId, amountCents, reason }),
  retryRefund: (kind: string, id: string) => send<any>("POST", "/api/admin/refunds/retry", { kind, id }),
  subscriptions: (p: Params) => get<Paged<{ subscriptions: any[]; overview: SubscriptionOverview }>>("/api/admin/subscriptions", p),
  subscriptionTransactions: (p: Params) =>
    get<Paged<{ transactions: any[]; totals: { grossCents: number; refundedCents: number } }>>("/api/admin/subscriptions/transactions", p),
  cancellations: (p: Params) => get<Paged<{ cancellations: any[]; totals: any }>>("/api/admin/cancellations", p),

  bonuses: (p: Params) => get<Paged<{ bonuses: any[] }>>("/api/admin/bonuses", p),
  updateBonus: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/bonuses/${id}`, body),
  maintenance: (p: Params) => get<Paged<{ records: any[]; spend: Record<string, { costCents: number; count: number }> }>>("/api/admin/maintenance", p),
  updateMaintenance: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/maintenance/${id}`, body),

  promos: (p: Params) => get<Paged<{ promos: any[] }>>("/api/admin/promos", p),
  createPromo: (body: Record<string, unknown>) => send<any>("POST", "/api/admin/promos", body),
  updatePromo: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/promos/${id}`, body),

  settings: () => get<{ settings: Settings; defaults: Settings; overrides: Record<string, any>; updatedAt: string | null }>("/api/admin/settings"),
  updateSettings: (body: Record<string, unknown>) => send<{ settings: Settings; changes: { path: string; from: unknown; to: unknown }[] }>("PATCH", "/api/admin/settings", body),

  audit: (p: Params) => get<Paged<{ logs: any[]; actions: string[] }>>("/api/admin/audit", p),
  health: () => get<any>("/api/admin/health"),

  admins: () => get<{ admins: AdminAccount[]; roles: { id: AdminRole; label: string; permissions: string[] }[] }>("/api/admin/admins"),
  createAdmin: (body: Record<string, unknown>) => send<{ admin: AdminAccount; created: boolean }>("POST", "/api/admin/admins", body),
  updateAdmin: (id: string, body: Record<string, unknown>) => send<any>("PATCH", `/api/admin/admins/${id}`, body),
};

export { getUser };
