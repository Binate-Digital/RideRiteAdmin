import { useCallback, useEffect, useState } from "react";
import { adminApi, errorMessage, type AdminAccount } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime, label, pct } from "@/lib/format";
import { getUser } from "@/lib/session";
import { Badge, btn, ConfirmDialog, DataTable, ErrorBanner, Field, FilterBar, inputCls, Notice, PageHeader, Panel, Section, Spinner, Stat } from "@/components/ui";

const PAGE_SIZE = 50;

/** TRD 6.9 audit trail: every admin action with actor, target, details and IP — filterable. */
export function AuditPage() {
  const [action, setAction] = useState("");
  const [actor, setActor] = useState("");
  const [targetId, setTargetId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [applied, setApplied] = useState({ action: "", actor: "", targetId: "", from: "", to: "" });
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.audit({ ...applied, page, limit: PAGE_SIZE });
      return { rows: res.logs, total: res.total, totalPages: res.totalPages, extra: res.actions };
    },
    [applied],
  );
  const actions: string[] = list.extra || [];
  const groups = [...new Set(actions.map((a) => `${a.split(".")[0]}.`))];
  return (
    <div className="space-y-4">
      <PageHeader title="AUDIT LOG" subtitle="Every admin action, newest first" />
      <Panel>
        <FilterBar>
          <select value={action} onChange={(e) => setAction(e.target.value)} className={inputCls}>
            <option value="">All actions</option>
            {groups.map((g) => (
              <option key={g} value={g}>{g}* (all)</option>
            ))}
            {actions.map((a) => (
              <option key={a} value={a}>{a}</option>
            ))}
          </select>
          <input value={actor} onChange={(e) => setActor(e.target.value)} placeholder="Actor email or id" className={inputCls} />
          <input value={targetId} onChange={(e) => setTargetId(e.target.value)} placeholder="Target id" className={inputCls} />
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          <button className={btn.primary} onClick={() => setApplied({ action, actor: actor.trim(), targetId: targetId.trim(), from, to })}>Filter</button>
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          empty="No audit entries."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "createdAt", label: "When", render: (l) => <span className="whitespace-nowrap">{dateTime(l.createdAt)}</span> },
            {
              key: "actor",
              label: "Actor",
              render: (l) => (
                <div>
                  <div>{l.actorName || l.actorEmail || "system"}</div>
                  <div className="text-xs text-muted">{l.actorEmail} {l.actorAdminRole ? `· ${label(l.actorAdminRole)}` : ""}</div>
                </div>
              ),
            },
            { key: "action", label: "Action", render: (l) => <span className="font-mono text-xs font-bold">{l.action}</span> },
            {
              key: "target",
              label: "Target",
              render: (l) => (
                <button className="text-left text-xs hover:text-primary" onClick={() => { setTargetId(l.targetId); setApplied((a) => ({ ...a, targetId: l.targetId })); }}>
                  {l.targetType} {l.targetId}
                </button>
              ),
            },
            {
              key: "meta",
              label: "Details",
              render: (l) => (
                <code className="block max-w-[380px] whitespace-pre-wrap break-words text-[11px] text-muted">
                  {Object.keys(l.meta || {}).length ? JSON.stringify(l.meta) : "—"}
                </code>
              ),
            },
            { key: "ip", label: "IP", render: (l) => <span className="text-xs">{l.ip || "—"}</span> },
          ]}
        />
      </Panel>
    </div>
  );
}

/** TRD 6.9 performance monitoring: latency percentiles, error rate, throughput, process, DB, sockets. */
export function HealthPage() {
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const load = useCallback(() => {
    adminApi
      .health()
      .then((d) => (setData(d), setError(null)))
      .catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(() => {
    load();
    const t = window.setInterval(load, 15000);
    return () => window.clearInterval(t);
  }, [load]);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const m = data.metrics;
  const ms = (v: number | null) => (v == null ? "—" : `${v} ms`);
  const uptime = data.process.uptimeSeconds;
  return (
    <div className="space-y-4">
      <PageHeader title="SYSTEM HEALTH" subtitle={`This API instance · last ${m.windowMinutes} min window (${m.coveredMinutes} min of data) · refreshes every 15 s`} />
      <ErrorBanner error={error} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="p50 latency" value={ms(m.overall.p50)} />
        <Stat label="p95 latency" value={ms(m.overall.p95)} />
        <Stat label="p99 latency" value={ms(m.overall.p99)} tone={m.overall.p99 > 1000 ? "warning" : undefined} />
        <Stat label="Throughput" value={`${m.overall.perMinute}/min`} sub={`${m.overall.count} requests`} />
        <Stat label="Server errors (5xx)" value={pct(m.overall.errorRate, 1)} tone={m.overall.errorRate > 0.01 ? "danger" : undefined} />
        <Stat label="Client errors (4xx)" value={pct(m.overall.clientErrorRate, 1)} />
        <Stat label="Database" value={data.db.ok ? `${data.db.pingMs} ms` : "DOWN"} tone={data.db.ok ? undefined : "danger"} sub="ping" />
        <Stat label="Live sockets" value={data.sockets.connections} sub={`${data.sockets.drivers} drivers · ${data.sockets.admins} admins`} />
      </div>
      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="Process">
          <div className="text-sm space-y-1">
            <div>Uptime {Math.floor(uptime / 3600)}h {Math.floor((uptime % 3600) / 60)}m</div>
            <div>Memory {data.process.rssMb} MB RSS · heap {data.process.heapUsedMb}/{data.process.heapTotalMb} MB</div>
            <div>Node {data.process.node} · {data.env} · payments {data.paymentsMode}</div>
          </div>
        </Section>
        <Section title="Data">
          <div className="text-sm space-y-1">
            <div>Users {data.counts.users}</div>
            <div>Drivers {data.counts.drivers}</div>
            <div>Trips {data.counts.trips}</div>
          </div>
        </Section>
        <Section title="Status">
          <div className="space-x-2">
            <Badge tone={data.db.ok ? "good" : "bad"}>db {data.db.ok ? "ok" : "down"}</Badge>
            <Badge tone={data.sockets.enabled ? "good" : "bad"}>realtime {data.sockets.enabled ? "on" : "off"}</Badge>
          </div>
        </Section>
      </div>
      <Panel>
        <div className="p-4 font-bold">Routes (busiest first)</div>
        <DataTable
          rows={m.routes}
          rowKey={(r) => r.route}
          empty="No traffic recorded yet."
          columns={[
            { key: "route", label: "Route", render: (r) => <span className="font-mono text-xs">{r.route}</span> },
            { key: "count", label: "Requests" },
            { key: "perMinute", label: "/min" },
            { key: "p50", label: "p50", render: (r) => ms(r.p50) },
            { key: "p95", label: "p95", render: (r) => ms(r.p95) },
            { key: "p99", label: "p99", render: (r) => ms(r.p99) },
            { key: "errorRate", label: "5xx", render: (r) => <span className={r.errorRate ? "text-danger" : ""}>{pct(r.errorRate, 1)}</span> },
            { key: "clientErrorRate", label: "4xx", render: (r) => pct(r.clientErrorRate, 1) },
          ]}
        />
      </Panel>
    </div>
  );
}

/** TRD 6.1 role permissions: super admins add admins and set their role. */
export function AdminsPage() {
  const [data, setData] = useState<{ admins: AdminAccount[]; roles: { id: string; label: string; permissions: string[] }[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [adding, setAdding] = useState(false);
  const [f, setF] = useState({ email: "", fullName: "", password: "", adminRole: "support" });
  const [act, setAct] = useState<{ admin: AdminAccount; body: Record<string, unknown>; title: string } | null>(null);
  const me = getUser();
  const load = useCallback(() => {
    adminApi.admins().then(setData).catch((e) => setError(errorMessage(e)));
  }, []);
  useEffect(load, [load]);
  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;

  return (
    <div className="space-y-4">
      <PageHeader title="ADMINS" subtitle="Admin accounts and their roles" actions={<button className={btn.primary} onClick={() => setAdding(true)}>Add admin</button>} />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <DataTable
          rows={data.admins}
          columns={[
            { key: "fullName", label: "Admin", render: (a) => <div><div className="font-semibold">{a.fullName}{a.id === me?.id ? " (you)" : ""}</div><div className="text-xs text-muted">{a.email}</div></div> },
            {
              key: "adminRole",
              label: "Role",
              render: (a) => (
                <select
                  value={a.adminRole}
                  disabled={a.id === me?.id}
                  className={inputCls}
                  onChange={(e) => setAct({ admin: a, body: { adminRole: e.target.value }, title: `Change role to ${label(e.target.value)}` })}
                >
                  {data.roles.map((r) => (
                    <option key={r.id} value={r.id}>{r.label}</option>
                  ))}
                </select>
              ),
            },
            { key: "isActive", label: "Status", render: (a) => <Badge tone={a.isActive ? "good" : "bad"}>{a.isActive ? "active" : "disabled"}</Badge> },
            { key: "lastLoginAt", label: "Last login", render: (a) => dateTime(a.lastLoginAt) },
          ]}
          actions={(a) =>
            a.id === me?.id ? null : (
              <div className="flex gap-2">
                <button className={a.isActive ? btn.danger : btn.ghost} onClick={() => setAct({ admin: a, body: { isActive: !a.isActive }, title: a.isActive ? "Disable admin" : "Enable admin" })}>
                  {a.isActive ? "Disable" : "Enable"}
                </button>
                <button className={btn.danger} onClick={() => setAct({ admin: a, body: { revoke: true }, title: "Remove admin access" })}>Remove</button>
              </div>
            )
          }
        />
      </Panel>
      <Section title="What each role can do">
        <div className="grid md:grid-cols-2 gap-3 text-xs">
          {data.roles.map((r) => (
            <div key={r.id} className="rounded-lg border border-border p-3">
              <div className="font-bold text-sm mb-1">{r.label}</div>
              <div className="text-muted leading-relaxed">{r.permissions.join(" · ")}</div>
            </div>
          ))}
        </div>
      </Section>
      <ConfirmDialog
        open={Boolean(act)}
        title={act?.title || ""}
        message={`${act?.admin.fullName} (${act?.admin.email})`}
        danger={Boolean(act?.body.revoke || act?.body.isActive === false)}
        onClose={() => setAct(null)}
        onConfirm={async () => {
          if (!act) return;
          await adminApi.updateAdmin(act.admin.id, act.body);
          setNotice("Saved.");
          load();
        }}
      />
      <ConfirmDialog
        open={adding}
        title="Add admin"
        confirmLabel="Add"
        message="An existing account with this email is promoted; otherwise a new admin account is created with this password."
        onClose={() => setAdding(false)}
        onConfirm={async () => {
          const res = await adminApi.createAdmin({
            email: f.email.trim(),
            adminRole: f.adminRole,
            ...(f.fullName.trim() ? { fullName: f.fullName.trim() } : {}),
            ...(f.password ? { password: f.password } : {}),
          });
          setNotice(res.created ? "Admin account created." : "Existing account promoted to admin.");
          setF({ email: "", fullName: "", password: "", adminRole: "support" });
          load();
        }}
      >
        <div className="mt-3 grid gap-3">
          <Field label="Email"><input value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} className={`w-full ${inputCls}`} /></Field>
          <Field label="Role">
            <select value={f.adminRole} onChange={(e) => setF({ ...f, adminRole: e.target.value })} className={`w-full ${inputCls}`}>
              {data.roles.map((r) => (
                <option key={r.id} value={r.id}>{r.label}</option>
              ))}
            </select>
          </Field>
          <Field label="Full name (new account)"><input value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} className={`w-full ${inputCls}`} /></Field>
          <Field label="Password (new account, 8+ characters)">
            <input type="password" autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} className={`w-full ${inputCls}`} />
          </Field>
        </div>
      </ConfirmDialog>
      <p className="text-xs text-muted">There must always be at least one active super admin.</p>
    </div>
  );
}
