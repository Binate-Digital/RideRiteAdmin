import { useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { adminApi, ApiError, type PlatformUser } from "@/lib/api";

export function UsersPage() {
  const [users, setUsers] = useState<PlatformUser[]>([]);
  const [q, setQ] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await adminApi.users();
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Failed to load users");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return users;
    return users.filter(
      (u) =>
        (u.fullName ?? "").toLowerCase().includes(needle) ||
        u.email.toLowerCase().includes(needle) ||
        (u.phone ?? "").includes(needle) ||
        u.id.includes(needle),
    );
  }, [users, q]);

  const setRole = async (userId: string, role: PlatformUser["role"]) => {
    setBusyId(userId);
    try {
      await adminApi.setUserRole(userId, role);
      setUsers((prev) => prev.map((u) => (u.id === userId ? { ...u, role } : u)));
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
        <div className="p-4 border-b border-border flex items-center gap-2">
          <Search className="h-4 w-4 text-muted" />
          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search name, email, phone…"
            className="flex-1 bg-transparent outline-none text-sm"
          />
          <span className="text-xs text-muted">{filtered.length}</span>
        </div>

        {loading && (
          <div className="p-8 grid place-items-center text-muted">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}

        {!loading && (
          <div className="divide-y divide-border">
            {filtered.map((u) => (
              <div key={u.id} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-semibold">{u.fullName || "—"}</div>
                  <div className="text-xs text-muted">
                    {u.email} · {u.phone || "no phone"} · {u.id.slice(0, 8)}…
                  </div>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {(["rider", "driver", "admin"] as const).map((role) => (
                    <button
                      key={role}
                      disabled={busyId === u.id || u.role === role}
                      onClick={() => void setRole(u.id, role)}
                      className={`rounded-md px-3 py-1.5 text-xs font-semibold border ${
                        u.role === role
                          ? "bg-primary text-primary-foreground border-primary"
                          : "border-border text-muted hover:text-foreground"
                      } disabled:opacity-50`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
              </div>
            ))}
            {filtered.length === 0 && (
              <div className="p-6 text-sm text-muted">No users match.</div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
