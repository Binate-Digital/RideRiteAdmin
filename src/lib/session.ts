export type AdminUser = {
  id: string;
  email: string;
  fullName: string | null;
  role: string;
  phone?: string | null;
};

const ACCESS_KEY = "rr_admin_access";
const REFRESH_KEY = "rr_admin_refresh";
const USER_KEY = "rr_admin_user";

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

export function setSession(
  tokens: { accessToken: string; refreshToken: string },
  user: AdminUser,
) {
  localStorage.setItem(ACCESS_KEY, tokens.accessToken);
  localStorage.setItem(REFRESH_KEY, tokens.refreshToken);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearSession() {
  localStorage.removeItem(ACCESS_KEY);
  localStorage.removeItem(REFRESH_KEY);
  localStorage.removeItem(USER_KEY);
}

export function isAdminSession() {
  const user = getUser();
  return Boolean(getAccessToken() && user?.role === "admin");
}
