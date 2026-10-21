import {
  clearSession,
  getAccessToken,
  getRefreshToken,
  getUser,
  setSession,
  type AdminUser,
} from "./session";

const DEFAULT_API_URL = "https://riderite-backend.deployment-uat.com";

export function getApiBaseUrl() {
  return (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, "") || DEFAULT_API_URL;
}

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

type RequestOptions = {
  method?: string;
  body?: unknown;
  auth?: boolean;
  skipRefresh?: boolean;
};

async function tryRefresh(): Promise<boolean> {
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;
  try {
    const res = await fetch(`${getApiBaseUrl()}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ refreshToken }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data?.accessToken || !data?.refreshToken || !data?.user) {
      clearSession();
      return false;
    }
    setSession(
      { accessToken: data.accessToken, refreshToken: data.refreshToken },
      {
        id: data.user.id,
        email: data.user.email,
        fullName: data.user.fullName ?? null,
        role: data.user.role,
        phone: data.user.phone ?? null,
      },
    );
    return true;
  } catch {
    clearSession();
    return false;
  }
}

export async function apiRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = "GET", body, auth = false, skipRefresh = false } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (auth) {
    const token = getAccessToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }

  const doFetch = () =>
    fetch(`${getApiBaseUrl()}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  let res = await doFetch();
  if (res.status === 401 && auth && !skipRefresh) {
    const ok = await tryRefresh();
    if (ok) {
      const token = getAccessToken();
      if (token) headers.Authorization = `Bearer ${token}`;
      res = await doFetch();
    }
  }

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new ApiError(res.status, data.error || `Request failed (${res.status})`);
  }
  return data as T;
}

export async function loginAdmin(email: string, password: string) {
  const data = await apiRequest<{
    accessToken: string;
    refreshToken: string;
    user: AdminUser & { id: string };
  }>("/api/auth/login", {
    method: "POST",
    body: { email, password },
  });

  const user = {
    id: data.user.id,
    email: data.user.email,
    fullName: data.user.fullName ?? null,
    role: data.user.role,
    phone: data.user.phone ?? null,
  };

  if (user.role !== "admin") {
    throw new ApiError(403, "Admin access only");
  }

  setSession(
    { accessToken: data.accessToken, refreshToken: data.refreshToken },
    user,
  );
  return user;
}

export function logoutAdmin() {
  clearSession();
}

export type Analytics = {
  totalTrips: number;
  completed: number;
  cancelled: number;
  active: number;
  trips7d: number;
  grossCents: number;
  paidCents: number;
  driverCounts: { approved: number; pending: number };
  totalUsers: number;
  totalDrivers: number;
};

export type PlatformUser = {
  id: string;
  fullName: string | null;
  email: string;
  phone: string | null;
  role: "rider" | "driver" | "admin";
  isActive: boolean;
  createdAt: string;
};

export type PlatformDriver = {
  id: string;
  userId: string;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  vehicleType: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleYear: number | null;
  vehiclePlate: string;
  verificationStatus: string;
  isApproved: boolean;
  status: "pending" | "approved" | "rejected" | "suspended";
  createdAt: string;
};

export type PlatformTrip = {
  id: string;
  status: string;
  pickupAddress: string;
  destinationAddress: string;
  vehicleType: string;
  paymentMethod: string;
  paid: boolean;
  fareCents: number;
  riderId: string | null;
  driverId: string | null;
  createdAt: string;
};

export type Paged<T> = {
  ok: true;
  page: number;
  limit: number;
  total: number;
  totalPages: number;
} & T;

function toQuery(params: Record<string, string | number | undefined | null>) {
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null || value === "") continue;
    qs.set(key, String(value));
  }
  const s = qs.toString();
  return s ? `?${s}` : "";
}

export const adminApi = {
  analytics: () => apiRequest<{ ok: true } & Analytics>("/api/admin/analytics", { auth: true }),
  users: (params: { q?: string; role?: string; page?: number; limit?: number } = {}) =>
    apiRequest<Paged<{ users: PlatformUser[] }>>(
      `/api/admin/users${toQuery(params)}`,
      { auth: true },
    ),
  setUserRole: (id: string, role: PlatformUser["role"]) =>
    apiRequest(`/api/admin/users/${id}/role`, { method: "PATCH", auth: true, body: { role } }),
  drivers: (params: { q?: string; status?: string; page?: number; limit?: number } = {}) =>
    apiRequest<Paged<{ drivers: PlatformDriver[] }>>(
      `/api/admin/drivers${toQuery(params)}`,
      { auth: true },
    ),
  setDriverStatus: (userId: string, status: PlatformDriver["status"], reason?: string | null) =>
    apiRequest(`/api/admin/drivers/${userId}/status`, {
      method: "PATCH",
      auth: true,
      body: { status, reason: reason ?? null },
    }),
  trips: (status?: string) =>
    apiRequest<{ ok: true; trips: PlatformTrip[] }>(
      `/api/admin/trips${status && status !== "all" ? `?status=${encodeURIComponent(status)}` : ""}`,
      { auth: true },
    ),
  revenue: () => apiRequest<Record<string, unknown>>("/api/admin/revenue", { auth: true }),
  subscriptions: () =>
    apiRequest<{ ok: true; subscriptions: any[] }>("/api/admin/subscriptions", { auth: true }),
  rentalListings: (status?: string) =>
    apiRequest<{ ok: true; listings: any[] }>(
      `/api/admin/rentals/listings${status ? `?status=${status}` : ""}`,
      { auth: true },
    ),
  updateRentalListing: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/api/admin/rentals/listings/${id}`, { method: "PATCH", auth: true, body }),
  rentalBookings: () =>
    apiRequest<{ ok: true; bookings: any[] }>("/api/admin/rentals/bookings", { auth: true }),
  chauffeur: () =>
    apiRequest<{ ok: true; bookings: any[] }>("/api/admin/chauffeur", { auth: true }),
  bonuses: (status?: string) =>
    apiRequest<{ ok: true; bonuses: any[] }>(
      `/api/admin/bonuses${status ? `?status=${status}` : ""}`,
      { auth: true },
    ),
  updateBonus: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/api/admin/bonuses/${id}`, { method: "PATCH", auth: true, body }),
  maintenance: () =>
    apiRequest<{ ok: true; records: any[] }>("/api/admin/maintenance", { auth: true }),
  updateMaintenance: (id: string, body: Record<string, unknown>) =>
    apiRequest(`/api/admin/maintenance/${id}`, { method: "PATCH", auth: true, body }),
  cancellations: () =>
    apiRequest<{ ok: true; cancellations: any[] }>("/api/admin/cancellations", { auth: true }),
  health: () => apiRequest<Record<string, unknown>>("/api/admin/health", { auth: true }),
  audit: () => apiRequest<{ ok: true; logs: any[] }>("/api/admin/audit", { auth: true }),
  setUserActive: (id: string, isActive: boolean) =>
    apiRequest(`/api/admin/users/${id}/active`, {
      method: "PATCH",
      auth: true,
      body: { isActive },
    }),
  refundTrip: (id: string, refundCents: number) =>
    apiRequest(`/api/admin/trips/${id}/refund`, {
      method: "PATCH",
      auth: true,
      body: { refundCents },
    }),
  exportUsersCsvUrl: () => `${getApiBaseUrl()}/api/admin/export/users.csv`,
  exportDriversCsvUrl: () => `${getApiBaseUrl()}/api/admin/export/drivers.csv`,
};

export { getUser };
