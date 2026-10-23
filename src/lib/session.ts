export type AdminRole = "super_admin" | "ops" | "finance" | "support";

export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  phone?: string | null;
  adminRole?: AdminRole;
  permissions?: string[];
};

const ACCESS_KEY = "rr_admin_access";
const REFRESH_KEY = "rr_admin_refresh";
const USER_KEY = "rr_admin_user";
const ACTIVITY_KEY = "rr_admin_last_activity";

export function getAccessToken() {
  return localStorage.getItem(ACCESS_KEY);
}

export function getRefreshToken() {
  return localStorage.getItem(REFRESH_KEY);
}

export function getUser(): AdminUser | null {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AdminUser;
  } catch {
    return null;
  }
}

export function setSession(tokens: { accessToken: string; refreshToken: string }, user: AdminUser) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  touchActivity();
}

export function setUser(user: AdminUser) {
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(ACTIVITY_KEY);
}

export function isAdminSession() {
  const user = getUser();
  return Boolean(getAccessToken() && user?.role === "admin");
}

/** Does the signed-in admin's role include this permission? (the API enforces it too) */
export function can(permission: string) {
  return Boolean(getUser()?.permissions?.includes(permission));
}

/** Last user activity, shared across tabs so one active tab keeps the others signed in. */
export function touchActivity(at = Date.now()) {
  localStorage.setItem(ACTIVITY_KEY, String(at));
}

export function lastActivity() {
  return Number(localStorage.getItem(ACTIVITY_KEY)) || Date.now();
}
