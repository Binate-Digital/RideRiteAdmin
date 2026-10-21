import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, ApiError, type PlatformTrip } from "@/lib/api";

const money = (cents: number) =>
  `$${(cents / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export function TripsPage() {
  const [trips, setTrips] = useState<PlatformTrip[]>([]);
  const [filter, setFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      try {
        const res = await adminApi.trips();
        if (alive) setTrips(res.trips);
      } catch (e) {
        if (alive) setError(e instanceof ApiError ? e.message : "Failed to load trips");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const filtered = useMemo(() => {
    if (filter === "all") return trips;
    if (filter === "active") {
      return trips.filter((t) =>
        ["requested", "accepted", "en_route", "arrived", "in_progress"].includes(t.status),
      );
    }
    return trips.filter((t) => t.status === filter);
  }, [trips, filter]);

  const filters = ["all", "active", "completed", "cancelled"];

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display text-4xl tracking-wide">TRIPS</h1>
        <p className="text-sm text-muted mt-1">Recent platform trips</p>
      </div>

      <div className="flex gap-2 flex-wrap">
        {filters.map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-md px-3 py-1.5 text-xs font-bold uppercase tracking-wider border ${
              filter === f
                ? "bg-primary text-primary-foreground border-primary"
                : "border-border text-muted hover:text-foreground"
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {loading && (
          <div className="p-8 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}
        {!loading && (
          <div className="divide-y divide-border">
            {filtered.map((t) => (
              <div key={t.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-semibold truncate">
                    {t.pickupAddress} → {t.destinationAddress}
                  </div>
                  <div className="text-xs text-muted mt-0.5">
                    {new Date(t.createdAt).toLocaleString()} · {t.vehicleType.toUpperCase()} · {t.paymentMethod} ·{" "}
                    {t.paid ? "paid" : "unpaid"}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {t.status}
                  </span>
                  <span className="font-bold text-primary">{money(t.fareCents)}</span>
                </div>
              </div>
            ))}
            {filtered.length === 0 && <div className="p-6 text-sm text-muted">No trips.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
