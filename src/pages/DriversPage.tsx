import { useEffect, useState } from "react";
import { Check, Loader2, Search, X } from "lucide-react";
import { adminApi, ApiError, type PlatformDriver } from "@/lib/api";
import { RejectReasonModal } from "@/components/RejectReasonModal";
import { Pagination } from "@/components/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;

export function DriversPage() {
  const [drivers, setDrivers] = useState<PlatformDriver[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [rejectTarget, setRejectTarget] = useState<PlatformDriver | null>(null);
  const debouncedQ = useDebouncedValue(q, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, status]);

  const load = async (opts?: { page?: number }) => {
    const nextPage = opts?.page ?? page;
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.drivers({
        q: debouncedQ.trim() || undefined,
        status: status === "all" ? undefined : status,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setDrivers(res.drivers);
      setTotal(res.total ?? res.drivers.length);
      setTotalPages(res.totalPages ?? 1);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load drivers");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedQ, status, page]);

  const applyStatus = async (
    userId: string,
    nextStatus: PlatformDriver["status"],
    reason: string | null = null,
  ) => {
    setBusyId(userId);
    setError(null);
    try {
      await adminApi.setDriverStatus(userId, nextStatus, reason);
      setRejectTarget(null);
      // Refresh current page so filters/pagination stay accurate
      await load();
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
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone, plate…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "pending", "approved", "rejected"] as const).map((s) => (
              <button
                key={s}
                type="button"
                onClick={() => setStatus(s)}
                className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider border ${
                  status === s
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {loading && (
          <div className="p-8 grid place-items-center text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}
        {!loading && (
          <>
            <div className="divide-y divide-border">
              {drivers.map((d) => (
                <div key={d.userId} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{d.fullName || "—"}</div>
                    <div className="text-xs text-muted">
                      {d.email || "no email"} ·{" "}
                      {[d.vehicleYear, d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ") ||
                        "no vehicle"}{" "}
                      · {d.vehiclePlate || "—"}
                    </div>
                    <div className="mt-1 inline-flex rounded-md border border-border px-2 py-0.5 text-[10px] uppercase tracking-wider text-muted">
                      {d.status}
                    </div>
                  </div>
                  {d.status !== "approved" && (
                    <div className="flex gap-2 flex-wrap">
                      <button
                        disabled={busyId === d.userId}
                        onClick={() => void applyStatus(d.userId, "approved")}
                        className="inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40"
                      >
                        <Check className="h-3 w-3" /> Approve
                      </button>
                      <button
                        disabled={busyId === d.userId}
                        onClick={() => {
                          setError(null);
                          setRejectTarget(d);
                        }}
                        className="inline-flex items-center gap-1 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-40"
                      >
                        <X className="h-3 w-3" /> Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {drivers.length === 0 && <div className="p-6 text-sm text-muted">No drivers match.</div>}
            </div>
            <Pagination
              page={page}
              totalPages={totalPages}
              total={total}
              limit={PAGE_SIZE}
              onPageChange={setPage}
              disabled={loading}
            />
          </>
        )}
      </div>

      <RejectReasonModal
        open={Boolean(rejectTarget)}
        driverName={rejectTarget?.fullName || rejectTarget?.email || undefined}
        busy={busyId === rejectTarget?.userId}
        onClose={() => setRejectTarget(null)}
        onConfirm={(reason) => {
          if (!rejectTarget) return;
          void applyStatus(rejectTarget.userId, "rejected", reason);
        }}
      />
    </div>
  );
}
