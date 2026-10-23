import { NavLink, Outlet, useNavigate } from "react-router-dom";
import {
  BarChart3,
  Users,
  Car,
  ShieldCheck,
  Map,
  LogOut,
  Menu,
  X,
  DollarSign,
  CreditCard,
  Key,
  Crown,
  Gift,
  Wrench,
  Ban,
  Activity,
  MessageSquareWarning,
  Banknote,
  RotateCcw,
  Tag,
  Settings,
  ScrollText,
  UserCog,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { getUser, logoutAdmin, refreshMe } from "@/lib/api";
import { can } from "@/lib/session";
import { closeAdminSocket } from "@/lib/realtime";
import { IDLE_MINUTES, useIdleLogout } from "@/hooks/useIdleLogout";

/** Sidebar entries and the permission each needs (the API enforces the same). */
export const NAV = [
  { to: "/", label: "Dashboard", icon: BarChart3, end: true, perm: "dashboard:read" },
  { to: "/users", label: "Users", icon: Users, perm: "users:read" },
  { to: "/drivers", label: "Drivers", icon: Car, perm: "drivers:read" },
  { to: "/kyc", label: "KYC", icon: ShieldCheck, perm: "drivers:read" },
  { to: "/trips", label: "Trips", icon: Map, perm: "trips:read" },
  { to: "/disputes", label: "Disputes", icon: MessageSquareWarning, perm: "disputes:manage" },
  { to: "/rentals", label: "Rentals", icon: Key, perm: "rentals:read" },
  { to: "/chauffeur", label: "Chauffeur", icon: Crown, perm: "chauffeur:read" },
  { to: "/revenue", label: "Revenue", icon: DollarSign, perm: "finance:read" },
  { to: "/payouts", label: "Payouts", icon: Banknote, perm: "finance:read" },
  { to: "/refunds", label: "Refunds", icon: RotateCcw, perm: "finance:read" },
  { to: "/subscriptions", label: "Subscriptions", icon: CreditCard, perm: "finance:read" },
  { to: "/cancellations", label: "Cancellations", icon: Ban, perm: "trips:read" },
  { to: "/bonuses", label: "Bonuses", icon: Gift, perm: "bonuses:manage" },
  { to: "/maintenance", label: "Maintenance", icon: Wrench, perm: "maintenance:manage" },
  { to: "/promos", label: "Promo codes", icon: Tag, perm: "promos:manage" },
  { to: "/settings", label: "Settings", icon: Settings, perm: "settings:read" },
  { to: "/audit", label: "Audit log", icon: ScrollText, perm: "audit:read" },
  { to: "/health", label: "Health", icon: Activity, perm: "health:read" },
  { to: "/admins", label: "Admins", icon: UserCog, perm: "admins:manage" },
];

const ROLE_LABEL: Record<string, string> = { super_admin: "Super admin", ops: "Operations", finance: "Finance", support: "Support" };

export function AdminLayout() {
  const navigate = useNavigate();
  const [user, setUserState] = useState(getUser());
  const [open, setOpen] = useState(false);

  const toLogin = useCallback(
    (reason?: string) => {
      closeAdminSocket();
      navigate(reason ? `/login?reason=${reason}` : "/login", { replace: true });
    },
    [navigate],
  );
  const onIdle = useCallback(() => toLogin("idle"), [toLogin]);
  useIdleLogout(onIdle);

  // Role / permissions may have changed since sign-in (a super admin edited this account)
  useEffect(() => {
    refreshMe().then(setUserState).catch(() => {});
  }, []);

  const logout = async () => {
    await logoutAdmin();
    toLogin();
  };

  return (
    <div className="min-h-screen bg-background text-foreground flex">
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 border-r border-border bg-surface transition-transform lg:static lg:translate-x-0 ${
          open ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        <div className="h-16 px-5 flex items-center justify-between border-b border-border">
          <div>
            <div className="text-display text-2xl tracking-wider text-primary">RIDERITE</div>
            <div className="text-[10px] uppercase tracking-[0.25em] text-muted">Control Center</div>
          </div>
          <button className="lg:hidden text-muted" onClick={() => setOpen(false)}>
            <X className="h-5 w-5" />
          </button>
        </div>
        <nav className="p-3 space-y-1 overflow-y-auto max-h-[calc(100vh-4rem)]">
          {NAV.filter((item) => can(item.perm)).map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive ? "bg-primary text-primary-foreground" : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && <button className="fixed inset-0 z-30 bg-black/50 lg:hidden" aria-label="Close menu" onClick={() => setOpen(false)} />}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-border bg-surface px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button className="lg:hidden rounded-md border border-border p-2 text-muted" onClick={() => setOpen(true)}>
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">
                {ROLE_LABEL[user?.adminRole || ""] || "Admin Panel"}
              </div>
              <div className="text-sm font-semibold">{user?.fullName || user?.email || "Admin"}</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px] text-muted">Signs out after {IDLE_MINUTES} min idle</span>
            <button
              onClick={() => void logout()}
              className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-2"
            >
              <LogOut className="h-4 w-4" />
              Logout
            </button>
          </div>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
