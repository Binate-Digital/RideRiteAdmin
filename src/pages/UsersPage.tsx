import { useEffect, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { adminApi, ApiError, type PlatformUser } from "@/lib/api";
import { Pagination } from "@/components/Pagination";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

const PAGE_SIZE = 20;

export function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "rider" | "driver">("all");
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const debouncedQ = useDebouncedValue(q, 350);

  useEffect(() => {
    setPage(1);
  }, [debouncedQ, role]);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await adminApi.users({
          q: debouncedQ.trim() || undefined,
          role: role === "all" ? undefined : role,
          page,
          limit: PAGE_SIZE,
        });
        if (!alive) return;
        setUsers(res.users);
        setTotal(res.total ?? res.users.length);
        setTotalPages(res.totalPages ?? 1);
      } catch (e) {
        if (!alive) return;
        setError(e instanceof ApiError ? e.message : "Failed to load users");
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => {
      alive = false;
    };
  }, [debouncedQ, role, page]);

  const setUserRole = async (userId: string, nextRole: PlatformUser["role"]) => {
    setBusyId(userId);
    try {
      await adminApi.setUserRole(userId, nextRole);
      // If filtered by role and role changed away, refresh list
      if (role !== "all" && role !== nextRole) {
        const res = await adminApi.users({
          q: debouncedQ.trim() || undefined,
          role,
          page,
          limit: PAGE_SIZE,
        });
        setUsers(res.users);
        setTotal(res.total ?? res.users.length);
        setTotalPages(res.totalPages ?? 1);
      } else {
        setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role: nextRole } : u)));
      }
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to update role");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display text-4xl tracking-wide">USERS</h1>
        <p className="text-sm text-muted mt-1">Manage platform accounts and roles</p>
      </div>

      <div className="rounded-xl border border-border bg-surface">
        <div className="p-4 border-b border-border flex flex-col sm:flex-row gap-3 sm:items-center">
          <div className="flex-1 flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
            <Search className="h-4 w-4 text-muted shrink-0" />
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Search name, email, phone…"
              className="flex-1 bg-transparent outline-none text-sm"
            />
          </div>
          <div className="flex gap-2 flex-wrap">
            {(["all", "rider", "driver"] as const).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRole(r)}
                className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider border ${
                  role === r
                    ? "bg-primary text-primary-foreground border-primary"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {r}
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
              {users.map((u) => (
                <div key={u.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-semibold">{u.fullName || "—"}</div>
                    <div className="text-xs text-muted">
                      {u.email} · {u.phone || "no phone"} · {u.id.slice(0, 8)}…
                    </div>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    {(["rider", "driver"] as const).map((r) => (
                      <button
                        key={r}
                        disabled={busyId === u.id || u.role === r}
                        onClick={() => void setUserRole(u.id, r)}
                        className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                          u.role === r
                            ? "bg-primary text-primary-foreground border-primary"
                            : "border-border text-muted hover:text-foreground"
                        } disabled:opacity-50`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
              {users.length === 0 && (
                <div className="p-6 text-sm text-muted">No users match.</div>
              )}
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
    </div>
  );
}
