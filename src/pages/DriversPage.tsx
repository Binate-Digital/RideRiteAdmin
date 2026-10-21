import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { adminApi, ApiError, type PlatformDriver } from "@/lib/api";

export function DriversPage() {
  const [drivers, setDrivers] = useState<PlatformDriver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.drivers();
      setDrivers(res.drivers);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const setStatus = async (userId: string, status: PlatformDriver["status"]) => {
    setBusyId(userId);
    try {
      let reason: string | null = null;
      if (status === "rejected" || status === "suspended") {
        reason = window.prompt("Reason (min 5 chars)?", "")?.trim() || null;
        if (!reason || reason.length < 5) {
          setError("Reason required (min 5 characters)");
          setBusyId(null);
          return;
        }
      }
      await adminApi.setDriverStatus(userId, status, reason);
      setDrivers((prev) =>
        prev.map((d) =>
          d.userId === userId
            ? {
                ...d,
                status,
                isApproved: status === "approved",
                verificationStatus: status === "approved" ? "approved" : status === "pending" ? "pending" : "rejected",
              }
            : d,
        ),
      );
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update driver");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display text-4xl tracking-wide">DRIVERS</h1>
        <p className="text-sm text-muted mt-1">Approve, reject, or suspend driver profiles</p>
      </div>

      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {loading && (
          <div className="p-8 grid place-items-center text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}
        {!loading && (
          <div className="divide-y divide-border">
            {drivers.map((d) => (
              <div key={d.userId} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{d.fullName || "—"}</div>
                  <div className="text-xs text-muted">
                    {d.email || "no email"} · {[d.vehicleYear, d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ") || "no vehicle"} ·{" "}
                    {d.vehiclePlate || "—"}
                  </div>
                  <div className="mt-1 inline-flex rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                    {d.status}
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <button
                    disabled={busyId === d.userId || d.status === "approved"}
                    onClick={() => void setStatus(d.userId, "approved")}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    disabled={busyId === d.userId}
                    onClick={() => void setStatus(d.userId, "rejected")}
                    className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-40"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
            {drivers.length === 0 && <div className="p-6 text-sm text-muted">No drivers yet.</div>}
          </div>
        )}
      </div>
    </div>
  );
}
