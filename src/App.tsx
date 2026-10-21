import type { ReactNode } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoginPage } from "@/pages/LoginPage";
import { DashboardPage } from "@/pages/DashboardPage";
import { UsersPage } from "@/pages/UsersPage";
import { DriversPage } from "@/pages/DriversPage";
import { KycPage } from "@/pages/KycPage";
import { TripsPage } from "@/pages/TripsPage";
import { isAdminSession } from "@/lib/session";

function RequireAdmin({ children }: { children: ReactNode }) {
  if (!isAdminSession()) return <Navigate to="/login" replace />;
  return children;
}

export default function App() {
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
        <Route index element={<DashboardPage />} />
        <Route path="users" element={<UsersPage />} />
        <Route path="drivers" element={<DriversPage />} />
        <Route path="kyc" element={<KycPage />} />
        <Route path="trips" element={<TripsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
