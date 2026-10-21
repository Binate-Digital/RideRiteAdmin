import { adminApi, ApiError } from "@/lib/api";
import { getAccessToken } from "@/lib/session";
import { GenericListPage } from "@/pages/GenericListPage";
import { RevenuePage } from "@/pages/RevenuePage";
import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";

const money = (c: number) => `$${((c || 0) / 100).toFixed(2)}`;

export { RevenuePage };

export function SubscriptionsPage() {
  return (
    <GenericListPage
      title="SUBSCRIPTIONS"
      subtitle="Driver membership plans"
      load={async () => (await adminApi.subscriptions()).subscriptions}
      columns={[
        { key: "fullName", label: "Driver" },
        { key: "email", label: "Email" },
        { key: "plan", label: "Plan" },
        { key: "status", label: "Status" },
        {
          key: "amountCents",
          label: "Amount",
          render: (r) => money(r.amountCents),
        },
        {
          key: "currentPeriodEnd",
          label: "Period end",
          render: (r) => (r.currentPeriodEnd ? new Date(r.currentPeriodEnd).toLocaleDateString() : "—"),
        },
      ]}
    />
  );
}

export function RentalsPage() {
  return (
    <GenericListPage
      title="RENTALS"
      subtitle="Peer-to-peer and fleet listings"
      load={async () => (await adminApi.rentalListings()).listings}
      columns={[
        { key: "title", label: "Title" },
        { key: "source", label: "Source" },
        { key: "vehicleType", label: "Type" },
        {
          key: "dailyRateCents",
          label: "Daily",
          render: (r) => money(r.dailyRateCents),
        },
        { key: "status", label: "Status" },
        { key: "city", label: "City" },
      ]}
      actions={(row, reload) => (
        <div className="flex gap-2">
          {row.status !== "active" && (
            <button
              className="text-xs font-bold text-primary"
              onClick={() => void adminApi.updateRentalListing(row.id, { status: "active" }).then(reload)}
            >
              Approve
            </button>
          )}
          {row.status === "active" && (
            <button
              className="text-xs font-bold text-muted"
              onClick={() => void adminApi.updateRentalListing(row.id, { status: "paused" }).then(reload)}
            >
              Pause
            </button>
          )}
        </div>
      )}
    />
  );
}

export function ChauffeurAdminPage() {
  return (
    <GenericListPage
      title="CHAUFFEUR"
      subtitle="Private driver bookings"
      load={async () => (await adminApi.chauffeur()).bookings}
      columns={[
        { key: "pickupAddress", label: "Pickup" },
        {
          key: "startAt",
          label: "Start",
          render: (r) => new Date(r.startAt).toLocaleString(),
        },
        { key: "durationHours", label: "Hours" },
        { key: "vehicleType", label: "Vehicle" },
        { key: "status", label: "Status" },
        { key: "totalCents", label: "Total", render: (r) => money(r.totalCents) },
      ]}
    />
  );
}

export function BonusesPage() {
  return (
    <GenericListPage
      title="BONUSES"
      subtitle="Monthly gift-card eligibility"
      load={async () => (await adminApi.bonuses()).bonuses}
      columns={[
        { key: "fullName", label: "Driver" },
        { key: "monthKey", label: "Month" },
        {
          key: "onTimeRate",
          label: "On-time",
          render: (r) => `${Math.round((r.onTimeRate || 0) * 100)}%`,
        },
        { key: "tripsCompleted", label: "Trips" },
        { key: "eligible", label: "Eligible", render: (r) => (r.eligible ? "yes" : "no") },
        { key: "status", label: "Status" },
        { key: "giftCardCents", label: "Gift card", render: (r) => money(r.giftCardCents) },
      ]}
      actions={(row, reload) =>
        row.status === "pending_review" ? (
          <div className="flex gap-2">
            <button
              className="text-xs font-bold text-primary"
              onClick={() => void adminApi.updateBonus(row.id, { status: "approved" }).then(reload)}
            >
              Approve
            </button>
            <button
              className="text-xs font-bold text-danger"
              onClick={() => void adminApi.updateBonus(row.id, { status: "rejected" }).then(reload)}
            >
              Reject
            </button>
          </div>
        ) : row.status === "approved" ? (
          <button
            className="text-xs font-bold text-primary"
            onClick={() => void adminApi.updateBonus(row.id, { status: "disbursed" }).then(reload)}
          >
            Mark disbursed
          </button>
        ) : null
      }
    />
  );
}

export function MaintenanceAdminPage() {
  return (
    <GenericListPage
      title="MAINTENANCE"
      subtitle="Oil changes & annual inspections"
      load={async () => (await adminApi.maintenance()).records}
      columns={[
        { key: "fullName", label: "Driver" },
        { key: "type", label: "Type" },
        { key: "title", label: "Title" },
        { key: "status", label: "Status" },
        {
          key: "dueAt",
          label: "Due",
          render: (r) => (r.dueAt ? new Date(r.dueAt).toLocaleDateString() : "—"),
        },
      ]}
      actions={(row, reload) =>
        row.status === "scheduled" ? (
          <button
            className="text-xs font-bold text-primary"
            onClick={() =>
              void adminApi.updateMaintenance(row.id, { status: "completed" }).then(reload)
            }
          >
            Complete
          </button>
        ) : null
      }
    />
  );
}

export function CancellationsPage() {
  return (
    <GenericListPage
      title="CANCELLATIONS"
      subtitle="Fees and refunds"
      load={async () => (await adminApi.cancellations()).cancellations}
      columns={[
        { key: "id", label: "Trip", render: (r) => r.id.slice(0, 8) },
        { key: "fareCents", label: "Fare", render: (r) => money(r.fareCents) },
        { key: "cancelFeeCents", label: "Fee", render: (r) => money(r.cancelFeeCents) },
        { key: "refundCents", label: "Refund", render: (r) => money(r.refundCents) },
        { key: "cancelReason", label: "Reason" },
        {
          key: "cancelledAt",
          label: "When",
          render: (r) => (r.cancelledAt ? new Date(r.cancelledAt).toLocaleString() : "—"),
        },
      ]}
    />
  );
}

export function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [logs, setLogs] = useState<any[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([adminApi.health(), adminApi.audit()])
      .then(([h, a]) => {
        setData(h);
        setLogs(a.logs || []);
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (error) return <div className="text-danger text-sm">{error}</div>;

  return (
    <div className="space-y-4">
      <h1 className="text-display text-4xl">SYSTEM HEALTH</h1>
      <div className="grid sm:grid-cols-4 gap-4">
        <Card label="API latency" value={`${data.latencyMs} ms`} />
        <Card label="Users" value={String(data.counts?.users ?? 0)} />
        <Card label="Drivers" value={String(data.counts?.drivers ?? 0)} />
        <Card label="Trips" value={String(data.counts?.trips ?? 0)} />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <div className="font-bold mb-2">Audit trail</div>
        <div className="divide-y divide-border max-h-96 overflow-auto">
          {logs.map((l) => (
            <div key={l.id} className="py-2 text-xs">
              <span className="text-muted">{new Date(l.createdAt).toLocaleString()}</span> ·{" "}
              <span className="font-semibold">{l.action}</span> · {l.targetType} {l.targetId}
            </div>
          ))}
          {logs.length === 0 && <div className="text-sm text-muted">No audit events yet.</div>}
        </div>
      </div>
    </div>
  );
}

function Card({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="text-[11px] uppercase tracking-wider text-muted font-bold">{label}</div>
      <div className="text-display text-2xl text-primary mt-1">{value}</div>
    </div>
  );
}

export async function downloadCsv(kind: "users" | "drivers") {
  const url =
    kind === "users" ? adminApi.exportUsersCsvUrl() : adminApi.exportDriversCsvUrl();
  const token = getAccessToken();
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) throw new Error("Export failed");
  const blob = await res.blob();
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${kind}.csv`;
  a.click();
}
