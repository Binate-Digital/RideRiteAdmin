import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime, label, money, parseDollars } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, DataTable, ErrorBanner, Field, FilterBar, inputCls, Notice, PageHeader, Panel, Pills, SearchBox, Stat } from "@/components/ui";

const PAGE_SIZE = 25;

/** TRD 6.6 driver payouts: pending balances, run all / one, history. */
export function PayoutsPage() {
  const [tab, setTab] = useState<"balances" | "history">("balances");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [run, setRun] = useState<{ driverId?: string; name?: string; cents?: number } | null>(null);
  const balances = usePagedList<any>(
    async (page) => {
      const res = await adminApi.payoutBalances({ q, page, limit: PAGE_SIZE });
      return { rows: res.balances, total: res.total, totalPages: res.totalPages };
    },
    [q],
  );
  const history = usePagedList<any>(
    async (page) => {
      const res = await adminApi.payouts({ status, page, limit: PAGE_SIZE });
      return { rows: res.payouts, total: res.total, totalPages: res.totalPages, extra: { pendingCents: res.pendingCents, pendingDrivers: res.pendingDrivers } };
    },
    [status],
  );
  const pending = history.extra;
  const canRun = can("finance:payouts");

  return (
    <div className="space-y-4">
      <PageHeader
        title="PAYOUTS"
        subtitle="Driver earnings → Stripe Connect transfers (simulated in mock mode and for seeded test accounts)"
        actions={canRun ? <button className={btn.primary} onClick={() => setRun({})}>Run payouts for all drivers</button> : null}
      />
      <div className="grid sm:grid-cols-2 gap-4">
        <Stat label="Pending earnings" value={money(pending?.pendingCents)} sub={`${pending?.pendingDrivers ?? 0} drivers`} />
        <Stat label="Payouts recorded" value={history.total} />
      </div>
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Pills value={tab} options={[{ id: "balances", label: "pending balances" }, { id: "history", label: "history" }]} onChange={setTab} />
      {tab === "balances" ? (
        <Panel>
          <FilterBar>
            <SearchBox placeholder="Driver name or email…" onChange={setQ} />
          </FilterBar>
          <div className="p-4 pb-0"><ErrorBanner error={balances.error} /></div>
          <DataTable
            rows={balances.rows}
            loading={balances.loading}
            rowKey={(r) => r.driverId}
            empty="No driver has pending earnings."
            paging={{ page: balances.page, totalPages: balances.totalPages, total: balances.total, limit: PAGE_SIZE, onPageChange: balances.setPage }}
            columns={[
              { key: "driver", label: "Driver", render: (r) => <Link to={`/drivers/${r.driverId}`} className="hover:text-primary">{r.driver?.fullName || r.driver?.email}</Link> },
              { key: "pendingCents", label: "Pending", render: (r) => <span className={r.pendingCents > 0 ? "font-bold text-primary" : "text-danger"}>{money(r.pendingCents)}</span> },
              { key: "entries", label: "Entries" },
              { key: "oldest", label: "Oldest", render: (r) => dateTime(r.oldestEarnedAt) },
              { key: "connect", label: "Stripe Connect", render: (r) => (r.connectReady ? <Badge tone="good">ready</Badge> : <Badge tone="warn">not ready</Badge>) },
              { key: "last", label: "Last payout", render: (r) => (r.lastPayout ? `${money(r.lastPayout.amountCents)} · ${r.lastPayout.status} · ${dateTime(r.lastPayout.at)}` : "—") },
            ]}
            actions={
              canRun
                ? (r) =>
                    r.pendingCents > 0 ? (
                      <button className={btn.ghost} onClick={() => setRun({ driverId: r.driverId, name: r.driver?.fullName, cents: r.pendingCents })}>Pay now</button>
                    ) : null
                : undefined
            }
          />
        </Panel>
      ) : (
        <Panel>
          <FilterBar>
            <Pills value={status} options={["all", "paid", "processing", "failed"] as const} onChange={setStatus} />
          </FilterBar>
          <div className="p-4 pb-0"><ErrorBanner error={history.error} /></div>
          <DataTable
            rows={history.rows}
            loading={history.loading}
            empty="No payouts yet."
            paging={{ page: history.page, totalPages: history.totalPages, total: history.total, limit: PAGE_SIZE, onPageChange: history.setPage }}
            columns={[
              { key: "createdAt", label: "When", render: (p) => dateTime(p.createdAt) },
              { key: "driver", label: "Driver", render: (p) => p.fullName || p.email || "—" },
              { key: "amountCents", label: "Amount", render: (p) => money(p.amountCents) },
              { key: "entryCount", label: "Entries" },
              { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
              { key: "transfer", label: "Transfer", render: (p) => <span className="text-xs">{p.stripeTransferId || p.failureReason || "—"}{p.simulated ? " (simulated)" : ""}</span> },
            ]}
          />
        </Panel>
      )}
      <ConfirmDialog
        open={Boolean(run)}
        title={run?.driverId ? "Pay this driver now" : "Run payouts"}
        message={
          run?.driverId
            ? `Transfer ${money(run.cents)} to ${run.name || "this driver"}'s Stripe Connect account.`
            : "Every driver's pending earnings are transferred to their Stripe Connect account. Drivers without a ready account are skipped."
        }
        confirmLabel="Run payout"
        onClose={() => setRun(null)}
        onConfirm={async () => {
          const res = await adminApi.runPayouts(run?.driverId);
          const paid = res.results.filter((r: any) => r.payout?.status === "paid");
          const skipped = res.results.filter((r: any) => r.skipped).length;
          const failed = res.results.filter((r: any) => r.error).length;
          setNotice(`${paid.length} paid (${money(paid.reduce((a: number, r: any) => a + r.payout.amountCents, 0))}) · ${skipped} skipped · ${failed} failed`);
          await Promise.all([balances.reload(), history.reload()]);
        }}
      />
    </div>
  );
}

/** TRD 6.6 / 6.8 refunds: owed-but-unsent, failed, issued; manual refund of any payment (≤ paid). */
export function RefundsPage() {
  const [state, setState] = useState<"pending" | "failed" | "issued" | "payments">("pending");
  const [q, setQ] = useState("");
  const [purpose, setPurpose] = useState("all");
  const [notice, setNotice] = useState<string | null>(null);
  const [refundFor, setRefundFor] = useState<any>(null);
  const [amount, setAmount] = useState("");
  const [retry, setRetry] = useState<any>(null);
  const queue = usePagedList<any>(
    async (page) => {
      if (state === "payments") {
        const res = await adminApi.payments({ q, purpose, page, limit: PAGE_SIZE });
        return { rows: res.payments, total: res.total, totalPages: res.totalPages };
      }
      const res = await adminApi.refunds({ state, page, limit: PAGE_SIZE });
      return { rows: res.refunds, total: res.total, totalPages: res.totalPages };
    },
    [state, q, purpose],
  );
  const canRefund = can("finance:refunds");

  return (
    <div className="space-y-4">
      <PageHeader title="REFUNDS" subtitle="Refunds owed, failures, history — and manual refunds" />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Pills
        value={state}
        options={[
          { id: "pending", label: "pending" },
          { id: "failed", label: "failed" },
          { id: "issued", label: "issued" },
          { id: "payments", label: "manual refund" },
        ]}
        onChange={setState}
      />
      <Panel>
        {state === "payments" && (
          <FilterBar>
            <SearchBox placeholder="Customer name / email, or payment / trip / booking id…" onChange={setQ} />
            <Pills value={purpose} options={["all", "ride", "rental", "chauffeur", "subscription"] as const} onChange={setPurpose} />
          </FilterBar>
        )}
        <div className="p-4 pb-0"><ErrorBanner error={queue.error} /></div>
        <DataTable
          rows={queue.rows}
          loading={queue.loading}
          rowKey={(r) => `${r.kind || r.purpose}-${r.id || r.paymentId}-${r.refundId || ""}`}
          empty={state === "pending" ? "No refunds waiting." : state === "failed" ? "No failures." : "Nothing here."}
          paging={{ page: queue.page, totalPages: queue.totalPages, total: queue.total, limit: PAGE_SIZE, onPageChange: queue.setPage }}
          columns={
            state === "payments"
              ? [
                  { key: "createdAt", label: "When", render: (p) => dateTime(p.createdAt) },
                  { key: "user", label: "Customer", render: (p) => p.user?.fullName || p.user?.email || "—" },
                  { key: "purpose", label: "For", render: (p) => (p.tripId ? <Link className="text-primary" to={`/trips/${p.tripId}`}>ride</Link> : p.purpose) },
                  { key: "amountCents", label: "Paid", render: (p) => money(p.amountCents) },
                  { key: "refundedCents", label: "Refunded", render: (p) => money(p.refundedCents) },
                  { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
                ]
              : state === "issued"
                ? [
                    { key: "createdAt", label: "When", render: (r) => dateTime(r.createdAt) },
                    { key: "user", label: "Customer", render: (r) => r.user?.fullName || r.user?.email || "—" },
                    { key: "purpose", label: "For", render: (r) => (r.tripId ? <Link className="text-primary" to={`/trips/${r.tripId}`}>ride</Link> : r.purpose) },
                    { key: "amountCents", label: "Refund", render: (r) => money(r.amountCents) },
                    { key: "reason", label: "Reason", render: (r) => r.reason || "—" },
                    { key: "refundId", label: "Refund id", render: (r) => <span className="text-xs">{r.refundId}{r.simulated ? " (simulated)" : ""}</span> },
                  ]
                : [
                    { key: "at", label: "When", render: (r) => dateTime(r.at) },
                    { key: "kind", label: "Kind", render: (r) => r.kind },
                    { key: "user", label: "Customer / driver", render: (r) => r.user?.fullName || r.user?.email || "—" },
                    { key: "amountCents", label: "Amount", render: (r) => money(r.amountCents) },
                    { key: "detail", label: "Detail", render: (r) => <span className="text-xs">{r.summary || r.reason} {r.paymentStatus ? `· ${label(r.paymentStatus)}` : ""}</span> },
                  ]
          }
          actions={
            canRefund && (state === "payments" || state === "pending")
              ? (r) =>
                  state === "payments" ? (
                    r.refundableCents > 0 ? (
                      <button className={btn.danger} onClick={() => { setAmount(""); setRefundFor(r); }}>Refund…</button>
                    ) : null
                  ) : ["trip", "rental", "chauffeur"].includes(r.kind) ? (
                    <button className={btn.ghost} onClick={() => setRetry(r)}>Send now</button>
                  ) : null
              : undefined
          }
        />
      </Panel>
      <ConfirmDialog
        open={Boolean(refundFor)}
        title="Manual refund"
        danger
        confirmLabel="Refund"
        message={refundFor ? `${refundFor.user?.fullName || refundFor.user?.email} · paid ${money(refundFor.amountCents)} · up to ${money(refundFor.refundableCents)} can be refunded.` : ""}
        reason={{ label: "Reason", minLength: 3 }}
        onClose={() => setRefundFor(null)}
        onConfirm={async (reason) => {
          const cents = parseDollars(amount);
          if (!cents) throw new Error("Enter an amount");
          if (cents > refundFor.refundableCents) throw new Error(`At most ${money(refundFor.refundableCents)} can be refunded`);
          const res = await adminApi.manualRefund(refundFor.id, cents, reason);
          setNotice(`Refunded ${money(res.refund.amountCents)}.`);
          await queue.reload();
        }}
      >
        <div className="mt-3">
          <Field label="Amount ($)">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} className={`w-40 ${inputCls}`} placeholder="0.00" />
          </Field>
        </div>
      </ConfirmDialog>
      <ConfirmDialog
        open={Boolean(retry)}
        title="Send refund now"
        message={retry ? `${money(retry.amountCents)} to ${retry.user?.fullName || retry.user?.email}. The payments sweeper also retries automatically.` : ""}
        onClose={() => setRetry(null)}
        onConfirm={async () => {
          await adminApi.retryRefund(retry.kind, retry.id);
          setNotice("Refund sent.");
          await queue.reload();
        }}
      />
    </div>
  );
}

/** TRD 6.6 subscription tracking: memberships and every membership transaction. */
export function SubscriptionsPage() {
  const [tab, setTab] = useState<"members" | "transactions">("members");
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const members = usePagedList<any>(
    async (page) => {
      const res = await adminApi.subscriptions({ q, status, page, limit: PAGE_SIZE });
      return { rows: res.subscriptions, total: res.total, totalPages: res.totalPages, extra: res.overview };
    },
    [q, status],
  );
  const tx = usePagedList<any>(
    async (page) => {
      const res = await adminApi.subscriptionTransactions({ q, page, limit: PAGE_SIZE });
      return { rows: res.transactions, total: res.total, totalPages: res.totalPages, extra: res.totals };
    },
    [q],
  );
  const o = members.extra;
  return (
    <div className="space-y-4">
      <PageHeader title="SUBSCRIPTIONS" subtitle="Driver memberships and their charges" />
      {o && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Active" value={o.active} />
          <Stat label="Past due" value={o.pastDue} tone={o.pastDue ? "warning" : undefined} />
          <Stat label="Canceled" value={o.canceled} />
          <Stat label="Expired" value={o.expired} />
          <Stat label="MRR" value={money(o.mrrCents)} />
        </div>
      )}
      <Pills value={tab} options={[{ id: "members", label: "memberships" }, { id: "transactions", label: "transactions" }]} onChange={setTab} />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Driver name or email…" onChange={setQ} />
          {tab === "members" && <Pills value={status} options={["all", "active", "past_due", "canceled", "expired", "incomplete"] as const} onChange={setStatus} />}
          {tab === "transactions" && tx.extra && (
            <span className="text-xs text-muted">Gross {money(tx.extra.grossCents)} · refunded {money(tx.extra.refundedCents)}</span>
          )}
        </FilterBar>
        {tab === "members" ? (
          <>
            <div className="p-4 pb-0"><ErrorBanner error={members.error} /></div>
            <DataTable
              rows={members.rows}
              loading={members.loading}
              paging={{ page: members.page, totalPages: members.totalPages, total: members.total, limit: PAGE_SIZE, onPageChange: members.setPage }}
              columns={[
                { key: "fullName", label: "Driver", render: (s) => <Link to={`/drivers/${s.userId}`} className="hover:text-primary">{s.fullName || s.email}</Link> },
                { key: "plan", label: "Plan" },
                { key: "status", label: "Status", render: (s) => <Badge>{s.status}</Badge> },
                { key: "amountCents", label: "Amount", render: (s) => money(s.amountCents) },
                { key: "currentPeriodEnd", label: "Period end", render: (s) => dateTime(s.currentPeriodEnd) },
                { key: "renew", label: "Renews", render: (s) => (s.cancelAtPeriodEnd ? "no" : "yes") },
              ]}
            />
          </>
        ) : (
          <>
            <div className="p-4 pb-0"><ErrorBanner error={tx.error} /></div>
            <DataTable
              rows={tx.rows}
              loading={tx.loading}
              empty="No membership charges."
              paging={{ page: tx.page, totalPages: tx.totalPages, total: tx.total, limit: PAGE_SIZE, onPageChange: tx.setPage }}
              columns={[
                { key: "createdAt", label: "When", render: (p) => dateTime(p.createdAt) },
                { key: "user", label: "Driver", render: (p) => p.user?.fullName || p.user?.email || "—" },
                { key: "plan", label: "Plan", render: (p) => p.plan || "—" },
                { key: "amountCents", label: "Amount", render: (p) => money(p.amountCents) },
                { key: "refundedCents", label: "Refunded", render: (p) => money(p.refundedCents) },
                { key: "status", label: "Status", render: (p) => <Badge>{p.status}</Badge> },
                { key: "provider", label: "Provider" },
              ]}
            />
          </>
        )}
      </Panel>
    </div>
  );
}
