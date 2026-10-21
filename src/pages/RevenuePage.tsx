import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, ApiError } from "@/lib/api";

const money = (c: number) =>
  `$${((c || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function RevenuePage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminApi
      .revenue()
      .then(setData)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed"))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Loader2 className="h-5 w-5 animate-spin text-primary" />;
  if (error) return <div className="text-danger text-sm">{error}</div>;

  const cards = [
    { label: "Trip gross", value: money(data.tripGrossCents) },
    { label: "Paid online", value: money(data.paidOnlineCents) },
    { label: "Cancel fees", value: money(data.cancelFeeCents) },
    { label: "Rental commission", value: money(data.rentalCommissionCents) },
    { label: "Rental volume", value: money(data.rentalVolumeCents) },
    { label: "Chauffeur gross", value: money(data.chauffeurGrossCents) },
  ];

  return (
    <div className="space-y-4">
      <h1 className="text-display text-4xl">REVENUE</h1>
      <p className="text-sm text-muted">Commissions, subscriptions, and fee totals</p>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((c) => (
          <div key={c.label} className="rounded-xl border border-border bg-surface p-5">
            <div className="text-[11px] uppercase tracking-wider text-muted font-bold">{c.label}</div>
            <div className="text-display text-3xl text-primary mt-1">{c.value}</div>
          </div>
        ))}
      </div>
      <div className="rounded-xl border border-border bg-surface p-5">
        <div className="text-sm font-bold mb-2">Active subscriptions</div>
        {(data.subscriptions || []).length === 0 && (
          <div className="text-sm text-muted">No active subscriptions</div>
        )}
        {(data.subscriptions || []).map((s: any) => (
          <div key={s._id} className="text-sm flex justify-between border-b border-border py-2">
            <span>{s._id}</span>
            <span>
              {s.count} · {money(s.amount)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
