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
} from "lucide-react";
import { useState } from "react";
import { getUser, logoutAdmin } from "@/lib/api";

const nav = [
  { to: "/", label: "Dashboard", icon: BarChart3, end: true },
  { to: "/users", label: "Users", icon: Users },
  { to: "/drivers", label: "Drivers", icon: Car },
  { to: "/kyc", label: "KYC", icon: ShieldCheck },
  { to: "/trips", label: "Trips", icon: Map },
];

export function AdminLayout() {
  const navigate = useNavigate();
  const user = getUser();
  const [open, setOpen] = useState(false);

  const logout = () => {
    logoutAdmin();
    navigate("/login", { replace: true });
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
        <nav className="p-3 space-y-1">
          {nav.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              onClick={() => setOpen(false)}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                  isActive
                    ? "bg-primary text-primary-foreground"
                    : "text-muted hover:bg-surface-2 hover:text-foreground"
                }`
              }
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </NavLink>
          ))}
        </nav>
      </aside>

      {open && (
        <button
          className="fixed inset-0 z-30 bg-black/50 lg:hidden"
          aria-label="Close menu"
          onClick={() => setOpen(false)}
        />
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <header className="h-16 border-b border-border bg-surface px-4 sm:px-6 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              className="lg:hidden rounded-md border border-border p-2 text-muted"
              onClick={() => setOpen(true)}
            >
              <Menu className="h-4 w-4" />
            </button>
            <div>
              <div className="text-xs uppercase tracking-[0.2em] text-muted">Admin Panel</div>
              <div className="text-sm font-semibold">{user?.fullName || user?.email || "Admin"}</div>
            </div>
          </div>
          <button
            onClick={logout}
            className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground hover:bg-surface-2"
          >
            <LogOut className="h-4 w-4" />
            Logout
          </button>
        </header>
        <main className="flex-1 p-4 sm:p-6 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
