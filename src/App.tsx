import { lazy, Suspense, type ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout, NAV } from "@/layouts/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";

// Each page is its own chunk, so login / the dashboard don't download every admin screen up front.
const named = <K extends string>(load: () => Promise<Record<K, React.ComponentType>>, name: K) =>
  lazy(() => load().then((m) => ({ default: m[name] })));
const DashboardPage = named(() => import("@/pages/DashboardPage"), "DashboardPage");
const UsersPage = named(() => import("@/pages/UsersPage"), "UsersPage");
const UserDetailPage = named(() => import("@/pages/UserDetailPage"), "UserDetailPage");
const DriversPage = named(() => import("@/pages/DriversPage"), "DriversPage");
const DriverDetailPage = named(() => import("@/pages/DriverDetailPage"), "DriverDetailPage");
const KycPage = named(() => import("@/pages/KycPage"), "KycPage");
const TripsPage = named(() => import("@/pages/TripsPage"), "TripsPage");
const TripDetailPage = named(() => import("@/pages/TripDetailPage"), "TripDetailPage");
const DisputesPage = named(() => import("@/pages/DisputesPage"), "DisputesPage");
const RentalsPage = named(() => import("@/pages/RentalsPage"), "RentalsPage");
const RevenuePage = named(() => import("@/pages/RevenuePage"), "RevenuePage");
const PayoutsPage = named(() => import("@/pages/FinancePages"), "PayoutsPage");
const RefundsPage = named(() => import("@/pages/FinancePages"), "RefundsPage");
const SubscriptionsPage = named(() => import("@/pages/FinancePages"), "SubscriptionsPage");
const BonusesPage = named(() => import("@/pages/ModulesPages"), "BonusesPage");
const CancellationsPage = named(() => import("@/pages/ModulesPages"), "CancellationsPage");
const ChauffeurAdminPage = named(() => import("@/pages/ModulesPages"), "ChauffeurAdminPage");
const MaintenanceAdminPage = named(() => import("@/pages/ModulesPages"), "MaintenanceAdminPage");
const PromosPage = named(() => import("@/pages/ModulesPages"), "PromosPage");
const SettingsPage = named(() => import("@/pages/SettingsPage"), "SettingsPage");
const AdminsPage = named(() => import("@/pages/SystemPages"), "AdminsPage");
const AuditPage = named(() => import("@/pages/SystemPages"), "AuditPage");
const HealthPage = named(() => import("@/pages/SystemPages"), "HealthPage");
import { can, isAdminSession } from "@/lib/session";
import { getApiBaseUrl } from "@/lib/api";

function RequireAdmin({ children }: { children: ReactNode }) {
  if (!isAdminSession()) return <Navigate to="/login" replace />;
  return children;
}

/** Pages the admin's role can't use aren't reachable by URL either (the API refuses them too). */
function Gate({ perm, children }: { perm: string; children: ReactNode }) {
  if (can(perm)) return children;
  const first = NAV.find((n) => can(n.perm));
  return (
    <div className="rounded-xl border border-border bg-surface p-6 text-sm text-muted">
      Your admin role doesn't have access to this page.
      {first && first.to !== "/" && (
        <a href={first.to} className="ml-2 font-bold text-primary">
          Go to {first.label}
        </a>
      )}
    </div>
  );
}

/** Build-time config check: the panel never guesses which backend to use. */
function ConfigError() {
  return (
    <div className="min-h-screen grid place-items-center bg-background px-4">
      <div className="max-w-lg rounded-2xl border border-danger/40 bg-surface p-8">
        <h1 className="text-display text-3xl text-danger">CONFIGURATION ERROR</h1>
        <p className="mt-3 text-sm text-muted">
          <code className="text-foreground">VITE_API_URL</code> is not set, so the admin panel doesn't know which RideRite
          backend to use. Set it in <code className="text-foreground">.env</code> (see <code>.env.example</code>) and
          rebuild / restart the dev server.
        </p>
      </div>
    </div>
  );
}

const PageLoading = () => <div className="p-6 text-sm text-muted">Loading…</div>;

const page = (perm: string, el: ReactNode) => (
  <Gate perm={perm}>
    <Suspense fallback={<PageLoading />}>{el}</Suspense>
  </Gate>
);

export default function App() {
  if (!getApiBaseUrl()) return <ConfigError />;
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        path="/"
        element={
          <RequireAdmin>
            <AdminLayout />
          </RequireAdmin>
        }
      >
        <Route index element={page("dashboard:read", <DashboardPage />)} />
        <Route path="users" element={page("users:read", <UsersPage />)} />
        <Route path="users/:id" element={page("users:read", <UserDetailPage />)} />
        <Route path="drivers" element={page("drivers:read", <DriversPage />)} />
        <Route path="drivers/:userId" element={page("drivers:read", <DriverDetailPage />)} />
        <Route path="kyc" element={page("drivers:read", <KycPage />)} />
        <Route path="trips" element={page("trips:read", <TripsPage />)} />
        <Route path="trips/:id" element={page("trips:read", <TripDetailPage />)} />
        <Route path="disputes" element={page("disputes:manage", <DisputesPage />)} />
        <Route path="rentals" element={page("rentals:read", <RentalsPage />)} />
        <Route path="chauffeur" element={page("chauffeur:read", <ChauffeurAdminPage />)} />
        <Route path="revenue" element={page("finance:read", <RevenuePage />)} />
        <Route path="payouts" element={page("finance:read", <PayoutsPage />)} />
        <Route path="refunds" element={page("finance:read", <RefundsPage />)} />
        <Route path="subscriptions" element={page("finance:read", <SubscriptionsPage />)} />
        <Route path="cancellations" element={page("trips:read", <CancellationsPage />)} />
        <Route path="bonuses" element={page("bonuses:manage", <BonusesPage />)} />
        <Route path="maintenance" element={page("maintenance:manage", <MaintenanceAdminPage />)} />
        <Route path="promos" element={page("promos:manage", <PromosPage />)} />
        <Route path="settings" element={page("settings:read", <SettingsPage />)} />
        <Route path="audit" element={page("audit:read", <AuditPage />)} />
        <Route path="health" element={page("health:read", <HealthPage />)} />
        <Route path="admins" element={page("admins:manage", <AdminsPage />)} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
