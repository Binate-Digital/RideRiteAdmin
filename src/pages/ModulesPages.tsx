import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { date, dateTime, label, money, parseDollars, pct } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, DataTable, ErrorBanner, Field, FilterBar, inputCls, Notice, PageHeader, Panel, Pills, SearchBox, Stat } from "@/components/ui";

const PAGE_SIZE = 25;

/** Private-driver bookings with rider, assigned driver and commission. */
export function ChauffeurAdminPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.chauffeur({ q, status, page, limit: PAGE_SIZE });
      return { rows: res.bookings, total: res.total, totalPages: res.totalPages };
    },
    [q, status],
  );
  return (
    <div className="space-y-4">
      <PageHeader title="CHAUFFEUR" subtitle="Private driver bookings" />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Rider / driver name or email, pickup…" onChange={setQ} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {["all", "active", "pending_payment", "requested", "confirmed", "driver_assigned", "in_progress", "completed", "cancelled", "expired"].map((s) => (
              <option key={s} value={s}>{label(s)}</option>
            ))}
          </select>
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "startAt", label: "Start", render: (r) => dateTime(r.startAt) },
            { key: "rider", label: "Rider", render: (r) => r.rider?.fullName || r.rider?.email || "—" },
            { key: "driver", label: "Driver", render: (r) => r.driver?.fullName || <span className="text-muted">unassigned</span> },
            { key: "pickup", label: "Pickup", render: (r) => <span className="block max-w-[240px] truncate" title={r.pickupAddress}>{r.pickupAddress}</span> },
            { key: "durationHours", label: "Hours" },
            { key: "totalCents", label: "Total", render: (r) => money(r.totalCents) },
            { key: "commissionCents", label: "Commission", render: (r) => (r.commissionCents == null ? "—" : money(r.commissionCents)) },
            { key: "status", label: "Status", render: (r) => <Badge>{r.status}</Badge> },
          ]}
        />
      </Panel>
    </div>
  );
}

/** TRD 6.7 bonus review: metrics, approve (gift-card code), reject, mark disbursed — Phase 4 transitions. */
export function BonusesPage() {
  const [status, setStatus] = useState("pending_review");
  const [notice, setNotice] = useState<string | null>(null);
  const [act, setAct] = useState<{ row: any; to: "approved" | "rejected" | "disbursed" } | null>(null);
  const [code, setCode] = useState("");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.bonuses({ status, page, limit: PAGE_SIZE });
      return { rows: res.bonuses, total: res.total, totalPages: res.totalPages };
    },
    [status],
  );
  return (
    <div className="space-y-4">
      <PageHeader title="BONUSES" subtitle="Monthly driver bonus eligibility (gift card / payout)" />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <FilterBar>
          <Pills value={status} options={["pending_review", "approved", "disbursed", "rejected", "ineligible", "in_progress", "all"] as const} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          empty="No bonuses in this state."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "fullName", label: "Driver", render: (b) => <Link to={`/drivers/${b.userId}`} className="hover:text-primary">{b.fullName || b.email}</Link> },
            { key: "monthKey", label: "Month" },
            {
              key: "metrics",
              label: "Metrics",
              render: (b) => (
                <div className="text-xs space-y-0.5">
                  <div>{b.tripsCompleted} trips (min {b.thresholds?.minTrips ?? "—"})</div>
                  <div>On time {pct(b.onTimeRate)} of {b.measuredTrips} (min {b.thresholds ? pct(b.thresholds.minOnTimeRate) : "—"})</div>
                  <div>Safe score {b.safeDrivingScore} (min {b.thresholds?.minSafeScore ?? "—"}) · rating {b.averageRating ?? "—"} · {b.incidents} incidents · {b.driverCancellations} cancels</div>
                </div>
              ),
            },
            { key: "giftCardCents", label: "Amount", render: (b) => money(b.giftCardCents) },
            {
              key: "status",
              label: "Status",
              render: (b) => (
                <div className="space-y-1">
                  <Badge>{b.status}</Badge>
                  {b.giftCardCode && <div className="text-xs text-muted">code on file</div>}
                  {b.adminNotes && <div className="text-xs text-muted max-w-[200px] truncate" title={b.adminNotes}>{b.adminNotes}</div>}
                </div>
              ),
            },
          ]}
          actions={
            can("bonuses:manage")
              ? (b) => (
                  <div className="flex gap-2">
                    {["pending_review", "rejected"].includes(b.status) && (
                      <button className={btn.primary} onClick={() => { setCode(""); setAct({ row: b, to: "approved" }); }}>Approve</button>
                    )}
                    {["pending_review", "approved"].includes(b.status) && (
                      <button className={btn.danger} onClick={() => setAct({ row: b, to: "rejected" })}>Reject</button>
                    )}
                    {b.status === "approved" && (
                      <button className={btn.ghost} onClick={() => { setCode(b.giftCardCode || ""); setAct({ row: b, to: "disbursed" }); }}>Mark disbursed</button>
                    )}
                  </div>
                )
              : undefined
          }
        />
      </Panel>
      <ConfirmDialog
        open={Boolean(act)}
        title={act?.to === "approved" ? "Approve bonus" : act?.to === "rejected" ? "Reject bonus" : "Mark disbursed"}
        message={
          act?.to === "approved"
            ? `${money(act.row.giftCardCents)} is credited to ${act.row.fullName}'s earnings and paid with the next payout. Add a gift-card code if you sent one.`
            : act?.to === "rejected"
              ? "An unpaid bonus credit is voided; the driver is notified."
              : "Record that the gift card was sent."
        }
        danger={act?.to === "rejected"}
        reason={act?.to === "rejected" ? { label: "Reason (sent to the driver)", minLength: 3 } : undefined}
        onClose={() => setAct(null)}
        onConfirm={async (reason) => {
          if (!act) return;
          await adminApi.updateBonus(act.row.id, {
            status: act.to,
            ...(act.to === "rejected" ? { adminNotes: reason } : {}),
            ...(act.to !== "rejected" && code.trim() ? { giftCardCode: code.trim() } : {}),
          });
          setNotice(`Bonus ${act.to}.`);
          await list.reload();
        }}
      >
        {act && act.to !== "rejected" && (
          <div className="mt-3">
            <Field label="Gift-card code (optional)">
              <input value={code} onChange={(e) => setCode(e.target.value)} className={`w-full ${inputCls}`} />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** TRD 6.7 maintenance: requested → scheduled → completed with cost; coverage spend by type. */
export function MaintenanceAdminPage() {
  const [status, setStatus] = useState("requested");
  const [notice, setNotice] = useState<string | null>(null);
  const [act, setAct] = useState<{ row: any; to: "scheduled" | "completed" | "cancelled" } | null>(null);
  const [when, setWhen] = useState("");
  const [cost, setCost] = useState("");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.maintenance({ status, page, limit: PAGE_SIZE });
      return { rows: res.records, total: res.total, totalPages: res.totalPages, extra: res.spend };
    },
    [status],
  );
  const spend = list.extra || {};
  return (
    <div className="space-y-4">
      <PageHeader title="MAINTENANCE" subtitle="Company-covered oil changes and annual inspections" />
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Oil changes covered" value={money(spend.oil_change?.costCents)} sub={`${spend.oil_change?.count ?? 0} completed`} />
        <Stat label="Inspections covered" value={money(spend.annual_inspection?.costCents)} sub={`${spend.annual_inspection?.count ?? 0} completed`} />
        <Stat label="Other" value={money(spend.other?.costCents)} sub={`${spend.other?.count ?? 0} completed`} />
      </div>
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <FilterBar>
          <Pills value={status} options={["requested", "scheduled", "completed", "cancelled", "all"] as const} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "fullName", label: "Driver", render: (r) => <Link to={`/drivers/${r.userId}`} className="hover:text-primary">{r.fullName || r.email}</Link> },
            { key: "title", label: "Service", render: (r) => <div>{r.title}<div className="text-xs text-muted">{label(r.type)}</div></div> },
            { key: "dueAt", label: "Due", render: (r) => date(r.dueAt) },
            { key: "scheduledFor", label: "Booked for", render: (r) => dateTime(r.scheduledFor) },
            { key: "costCents", label: "Cost", render: (r) => money(r.costCents) },
            { key: "status", label: "Status", render: (r) => <div><Badge>{r.status}</Badge>{r.completedAt && <div className="text-xs text-muted">{date(r.completedAt)}</div>}</div> },
          ]}
          actions={
            can("maintenance:manage")
              ? (r) => (
                  <div className="flex gap-2">
                    {r.status === "requested" && (
                      <button className={btn.ghost} onClick={() => { setWhen(""); setAct({ row: r, to: "scheduled" }); }}>Schedule</button>
                    )}
                    {["requested", "scheduled"].includes(r.status) && (
                      <>
                        <button className={btn.primary} onClick={() => { setCost(r.costCents ? (r.costCents / 100).toFixed(2) : ""); setAct({ row: r, to: "completed" }); }}>Complete</button>
                        <button className={btn.danger} onClick={() => setAct({ row: r, to: "cancelled" })}>Cancel</button>
                      </>
                    )}
                  </div>
                )
              : undefined
          }
        />
      </Panel>
      <ConfirmDialog
        open={Boolean(act)}
        title={act?.to === "scheduled" ? "Schedule service" : act?.to === "completed" ? "Complete service" : "Cancel request"}
        message={
          act?.to === "completed"
            ? "Record what the platform paid. The driver's next service is scheduled from today."
            : act?.to === "scheduled"
              ? "The driver is notified of the appointment."
              : "The request is closed."
        }
        danger={act?.to === "cancelled"}
        onClose={() => setAct(null)}
        onConfirm={async () => {
          if (!act) return;
          const body: Record<string, unknown> = { status: act.to };
          if (act.to === "scheduled") {
            if (!when) throw new Error("Pick the appointment date and time");
            body.scheduledFor = new Date(when).toISOString();
          }
          if (act.to === "completed") {
            const cents = parseDollars(cost || "0");
            if (cents == null) throw new Error("Cost must be a dollar amount");
            body.costCents = cents;
          }
          await adminApi.updateMaintenance(act.row.id, body);
          setNotice(`Service ${act.to}.`);
          await list.reload();
        }}
      >
        {act?.to === "scheduled" && (
          <div className="mt-3">
            <Field label="Appointment">
              <input type="datetime-local" value={when} onChange={(e) => setWhen(e.target.value)} className={`w-full ${inputCls}`} />
            </Field>
          </div>
        )}
        {act?.to === "completed" && (
          <div className="mt-3">
            <Field label="Cost paid by RideRite ($)">
              <input value={cost} onChange={(e) => setCost(e.target.value)} className={`w-40 ${inputCls}`} placeholder="0.00" />
            </Field>
          </div>
        )}
      </ConfirmDialog>
    </div>
  );
}

/** TRD 6.8 cancellation records: who cancelled, fee applied, refund. */
export function CancellationsPage() {
  const [kind, setKind] = useState<"trips" | "rentals" | "chauffeur">("trips");
  const [by, setBy] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.cancellations({ kind, by, from, to, page, limit: PAGE_SIZE });
      return { rows: res.cancellations, total: res.total, totalPages: res.totalPages, extra: res.totals };
    },
    [kind, by, from, to],
  );
  const t = list.extra;
  const byOptions = kind === "rentals" ? ["all", "renter", "owner", "system"] : ["all", "rider", "driver", "system"];
  return (
    <div className="space-y-4">
      <PageHeader title="CANCELLATIONS" subtitle="Cancellation records, fees applied and refunds — fee rules live in Settings" />
      {t && (
        <div className="grid sm:grid-cols-3 gap-4">
          <Stat label="Cancellations" value={t.count} />
          <Stat label={kind === "trips" ? "Fees charged" : "Kept (paid − refunded)"} value={kind === "trips" ? money(t.feeCents) : "see rows"} />
          <Stat label="Refunded" value={money(t.refundCents)} />
        </div>
      )}
      <Panel>
        <FilterBar>
          <Pills value={kind} options={["trips", "rentals", "chauffeur"] as const} onChange={(k) => { setBy("all"); setKind(k); }} />
          <select value={by} onChange={(e) => setBy(e.target.value)} className={inputCls}>
            {byOptions.map((b) => (
              <option key={b} value={b}>{b === "all" ? "cancelled by anyone" : `by ${b}`}</option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} /></label>
          <label className="flex items-center gap-2 text-xs text-muted">To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} /></label>
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "cancelledAt", label: "When", render: (r) => dateTime(r.cancelledAt) },
            { key: "summary", label: "Booking", render: (r) => (kind === "trips" ? <Link className="hover:text-primary block max-w-[280px] truncate" to={`/trips/${r.id}`}>{r.summary}</Link> : r.summary) },
            { key: "rider", label: kind === "rentals" ? "Renter" : "Rider", render: (r) => r.rider?.fullName || r.rider?.email || "—" },
            { key: "cancelledBy", label: "Cancelled by", render: (r) => r.cancelledBy || "—" },
            { key: "stage", label: "Stage", render: (r) => r.tripStatusAtCancel || "—" },
            { key: "reason", label: "Reason", render: (r) => <span className="block max-w-[200px] truncate" title={r.reason || ""}>{r.reason || "—"}</span> },
            { key: "fareCents", label: "Price", render: (r) => money(r.fareCents) },
            { key: "feeCents", label: kind === "trips" ? "Fee" : "Kept", render: (r) => money(r.feeCents) },
            { key: "refundCents", label: "Refund", render: (r) => `${money(r.refundCents)}${r.refundPercent != null ? ` (${r.refundPercent}%)` : ""}` },
          ]}
        />
      </Panel>
    </div>
  );
}

/** Promo codes: list, create (optional announcement to opted-in riders), enable / disable. */
export function PromosPage() {
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [f, setF] = useState({ code: "", kind: "percent", value: "", maxUses: "", expiresAt: "", announce: false });
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.promos({ status, page, limit: 50 });
      return { rows: res.promos, total: res.total, totalPages: res.totalPages };
    },
    [status],
  );
  const manage = can("promos:manage");
  return (
    <div className="space-y-4">
      <PageHeader title="PROMO CODES" subtitle="Ride discounts" actions={manage ? <button className={btn.primary} onClick={() => setCreating(true)}>New promo</button> : null} />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <FilterBar>
          <Pills value={status} options={["all", "active", "inactive"] as const} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0"><ErrorBanner error={list.error} /></div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: 50, onPageChange: list.setPage }}
          columns={[
            { key: "code", label: "Code", render: (p) => <span className="font-mono font-bold">{p.code}</span> },
            { key: "discount", label: "Discount", render: (p) => (p.percentOff ? `${p.percentOff}% off` : `${money(p.amountOffCents)} off`) },
            { key: "uses", label: "Uses", render: (p) => `${p.uses ?? p.usedCount ?? 0}${p.maxUses ? ` / ${p.maxUses}` : ""}` },
            { key: "expiresAt", label: "Expires", render: (p) => date(p.expiresAt) },
            { key: "active", label: "Status", render: (p) => <Badge tone={p.active ? "good" : "muted"}>{p.active ? "active" : "disabled"}</Badge> },
          ]}
          actions={
            manage
              ? (p) => (
                  <button
                    className={p.active ? btn.danger : btn.ghost}
                    onClick={() =>
                      void adminApi
                        .updatePromo(p.id, { active: !p.active })
                        .then(() => {
                          setNotice(`${p.code} ${p.active ? "disabled" : "enabled"}.`);
                          return list.reload();
                        })
                        .catch((e) => list.setError(e.message))
                    }
                  >
                    {p.active ? "Disable" : "Enable"}
                  </button>
                )
              : undefined
          }
        />
      </Panel>
      <ConfirmDialog
        open={creating}
        title="New promo code"
        confirmLabel="Create"
        onClose={() => setCreating(false)}
        onConfirm={async () => {
          const value = Number(f.value);
          if (!f.code.trim()) throw new Error("Enter a code");
          if (!(value > 0)) throw new Error("Enter the discount");
          const body: Record<string, unknown> = { code: f.code.trim(), announce: f.announce };
          if (f.kind === "percent") body.percentOff = value;
          else body.amountOffCents = parseDollars(f.value);
          if (f.maxUses) body.maxUses = Number(f.maxUses);
          if (f.expiresAt) body.expiresAt = new Date(`${f.expiresAt}T23:59:59`).toISOString();
          await adminApi.createPromo(body);
          setNotice(`Promo ${f.code.toUpperCase()} created${f.announce ? " and announced" : ""}.`);
          setF({ code: "", kind: "percent", value: "", maxUses: "", expiresAt: "", announce: false });
          await list.reload();
        }}
      >
        <div className="grid grid-cols-2 gap-3">
          <Field label="Code"><input value={f.code} onChange={(e) => setF({ ...f, code: e.target.value })} className={`w-full ${inputCls}`} placeholder="SUMMER10" /></Field>
          <Field label="Type">
            <select value={f.kind} onChange={(e) => setF({ ...f, kind: e.target.value })} className={`w-full ${inputCls}`}>
              <option value="percent">% off</option>
              <option value="amount">$ off</option>
            </select>
          </Field>
          <Field label={f.kind === "percent" ? "Percent" : "Amount ($)"}><input value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} className={`w-full ${inputCls}`} /></Field>
          <Field label="Max uses"><input value={f.maxUses} onChange={(e) => setF({ ...f, maxUses: e.target.value })} className={`w-full ${inputCls}`} placeholder="unlimited" /></Field>
          <Field label="Expires"><input type="date" value={f.expiresAt} onChange={(e) => setF({ ...f, expiresAt: e.target.value })} className={`w-full ${inputCls}`} /></Field>
          <label className="flex items-center gap-2 text-sm self-end pb-2">
            <input type="checkbox" checked={f.announce} onChange={(e) => setF({ ...f, announce: e.target.checked })} />
            Announce to opted-in riders
          </label>
        </div>
      </ConfirmDialog>
    </div>
  );
}
