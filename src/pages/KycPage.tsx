import { useEffect, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { adminApi, ApiError, type PlatformDriver } from "@/lib/api";
import { RejectReasonModal } from "@/components/RejectReasonModal";

export function KycPage() {
  const [rows, setRows] = useState<PlatformDriver[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlatformDriver | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.drivers({ status: "pending", page: 1, limit: 100 });
      setRows(res.drivers);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load KYC");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const act = async (userId: string, status: "approved" | "rejected", reason: string | null = null) => {
    setBusyId(userId);
    setError(null);
    try {
      await adminApi.setDriverStatus(userId, status, reason);
      setRows((prev) => prev.filter((r) => r.userId !== userId));
      setRejectTarget(null);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Update failed");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display text-4xl tracking-wide">KYC</h1>
        <p className="text-sm text-muted mt-1">Pending driver verification submissions</p>
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
            {rows.map((r) => (
              <div key={r.userId} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{r.fullName || "—"}</div>
                  <div className="text-xs text-muted font-mono">{r.userId}</div>
                  <div className="text-sm mt-1">
                    {r.email || "no email"} ·{" "}
                    {[r.vehicleYear, r.vehicleMake, r.vehicleModel].filter(Boolean).join(" ")}
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    disabled={busyId === r.userId}
                    onClick={() => void act(r.userId, "approved")}
                    className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                  >
                    <Check className="h-3 w-3" /> Approve
                  </button>
                  <button
                    disabled={busyId === r.userId}
                    onClick={() => {
                      setError(null);
                      setRejectTarget(r);
                    }}
                    className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-40"
                  >
                    <X className="h-3 w-3" /> Reject
                  </button>
                </div>
              </div>
            ))}
            {rows.length === 0 && <div className="p-6 text-sm text-muted">No KYC submissions pending.</div>}
          </div>
        )}
      </div>

      <RejectReasonModal
        open={Boolean(rejectTarget)}
        driverName={rejectTarget?.fullName || rejectTarget?.email || undefined}
        busy={busyId === rejectTarget?.userId}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          void act(rejectTarget.userId, "rejected", reason);
        }}
      />
    </div>
  );
}
