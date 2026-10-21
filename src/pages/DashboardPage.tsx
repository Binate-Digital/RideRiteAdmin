import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, ApiError, type Analytics } from "@/lib/api";

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function DashboardPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await adminApi.analytics();
        if (alive) setData(res);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Failed to load analytics");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (loading) {
    return (
      <div className="grid place-items-center py-20 text-muted">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (error || !data) {
    return <div className="rounded-xl border border-danger/40 bg-danger/10 p-4 text-sm text-danger">{error}</div>;
  }

  const cards = [
    { label: "Total trips", value: String(data.totalTrips), sub: `${data.trips7d} in last 7 days` },
    { label: "Completed", value: String(data.completed) },
    { label: "Active now", value: String(data.active) },
    { label: "Cancelled", value: String(data.cancelled) },
    { label: "Gross fares", value: money(data.grossCents), sub: "All completed trips" },
    { label: "Paid online", value: money(data.paidCents), sub: "Card / Cash App / PayPal" },
    { label: "Approved drivers", value: String(data.driverCounts.approved ?? 0) },
    { label: "Pending drivers", value: String(data.driverCounts.pending ?? 0) },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-display text-4xl tracking-wide">DASHBOARD</h1>
        <p className="text-sm text-muted mt-1">Platform analytics from live Mongo data</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{c.label}</div>
            <div className="mt-1 text-display text-3xl text-primary">{c.value}</div>
            {c.sub && <div className="mt-1 text-xs text-muted">{c.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}
