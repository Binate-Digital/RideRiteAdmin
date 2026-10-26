import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { adminApi, errorMessage } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime, label, money, parseDollars } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, DataTable, ErrorBanner, Field, FilterBar, inputCls, Modal, Notice, PageHeader, Panel, Pills, SearchBox } from "@/components/ui";

const PAGE_SIZE = 20;

/** TRD 6.4 dispute handling: riders' "Report a problem" → review → resolve (optional refund, driver note). */
export function DisputesPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<"unresolved" | "open" | "in_review" | "resolved" | "all">("unresolved");
  const [notice, setNotice] = useState<string | null>(null);
  const [open, setOpen] = useState<any>(null);
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.disputes({ q, status, page, limit: PAGE_SIZE });
      return { rows: res.disputes, total: res.total, totalPages: res.totalPages };
    },
    [q, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="DISPUTES" subtitle="Problems riders reported on trips, plus complaints from the website's Florida safety form" />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Rider / driver name or email, trip id…" onChange={setQ} />
          <Pills value={status} options={["unresolved", "open", "in_review", "resolved", "all"] as const} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0">
          <ErrorBanner error={list.error} />
        </div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          empty="No disputes."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            { key: "createdAt", label: "Reported", render: (d) => dateTime(d.createdAt) },
            {
              key: "rider",
              label: "Reporter",
              render: (d) =>
                d.rider?.fullName || d.rider?.email || (d.contact ? `${d.contact.name} (${d.contact.email})` : "—"),
            },
            { key: "driver", label: "Driver", render: (d) => d.driver?.fullName || "—" },
            {
              key: "issue",
              label: "Issue",
              render: (d) => (
                <div className="max-w-[320px]">
                  <div className="text-xs font-bold uppercase text-muted">
                    {d.priority === "urgent" && <span className="text-danger">Urgent · </span>}
                    {d.source === "complaint" ? `Complaint · ${label(d.complaintCategory)}` : label(d.category)}
                  </div>
                  <div className="truncate" title={d.description}>{d.description}</div>
                </div>
              ),
            },
            {
              key: "trip",
              label: "Trip",
              render: (d) =>
                d.tripId ? (
                  <Link to={`/trips/${d.tripId}`} className="text-primary text-xs">
                    {d.trip ? `${money(d.trip.fareCents)} · ${d.trip.status}` : "open"}
                  </Link>
                ) : (
                  <span className="text-xs text-muted">{d.tripRef ? `given: ${d.tripRef}` : "—"}</span>
                ),
            },
            { key: "status", label: "Status", render: (d) => <Badge>{d.status}</Badge> },
          ]}
          actions={(d) => (
            <button className={btn.ghost} onClick={() => setOpen(d)}>
              {d.status === "resolved" ? "View" : "Handle"}
            </button>
          )}
        />
      </Panel>
      {open && (
        <DisputeModal
          dispute={open}
          onClose={() => setOpen(null)}
          onSaved={(msg) => {
            setNotice(msg);
            setOpen(null);
            void list.reload();
          }}
        />
      )}
    </div>
  );
}

function DisputeModal({ dispute: d, onClose, onSaved }: { dispute: any; onClose: () => void; onSaved: (msg: string) => void }) {
  const [notes, setNotes] = useState(d.resolutionNotes || "");
  const [driverNote, setDriverNote] = useState(d.driverNote || "");
  const [refund, setRefund] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolved = d.status === "resolved";
  const canRefund = can("trips:refund") && d.trip?.paidOnline;
  useEffect(() => setError(null), [notes, refund]);

  const save = async (status: "in_review" | "resolved" | "open") => {
    const body: Record<string, unknown> = { status, resolutionNotes: notes.trim(), driverNote: driverNote.trim() };
    if (status === "resolved") {
      if (notes.trim().length < 3) return setError("Write resolution notes — they are sent to the rider.");
      if (refund.trim()) {
        const cents = parseDollars(refund);
        if (!cents) return setError("Refund must be a dollar amount");
        body.refundCents = cents;
      }
    }
    setBusy(true);
    try {
      const res = await adminApi.updateDispute(d.id, body);
      onSaved(
        status === "resolved"
          ? `Resolved${res.refund ? ` with a ${money(res.refund.amountCents)} refund` : ""} — the rider was notified.`
          : status === "in_review"
            ? "Marked in review."
            : "Reopened.",
      );
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title="Dispute" subtitle={`${label(d.category)} · reported ${dateTime(d.createdAt)}`} onClose={onClose} wide>
      <div className="space-y-3 text-sm">
        <div className="rounded-lg border border-border bg-background p-3">
          <div className="text-xs text-muted mb-1">
            {d.source === "complaint" ? (
              <>
                Website complaint ({label(d.complaintCategory)}) from {d.contact?.name} · {d.contact?.email}
                {d.contact?.phone ? ` · ${d.contact.phone}` : ""}
                {d.incidentAt ? ` · incident ${dateTime(d.incidentAt)}` : ""}
                {!d.tripId && d.tripRef ? ` · trip id given: ${d.tripRef} (not found)` : ""}
              </>
            ) : (
              <>
                {d.rider?.fullName || d.rider?.email} on a trip with {d.driver?.fullName || "no driver"}
              </>
            )}
            {d.trip ? ` — ${d.trip.pickupAddress} → ${d.trip.destinationAddress} (${money(d.trip.fareCents)})` : ""}
          </div>
          {d.description}
        </div>
        {d.tripId && <Link to={`/trips/${d.tripId}`} className={btn.link}>Open trip (route, payments, chat transcript) →</Link>}
        <Field label={d.source === "complaint" && !d.riderId ? "Resolution notes (emailed to the reporter)" : "Resolution notes (sent to the rider)"}>
          <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} disabled={resolved} className={`w-full ${inputCls}`} />
        </Field>
        <Field label="Note to the driver (optional)">
          <textarea value={driverNote} onChange={(e) => setDriverNote(e.target.value)} rows={2} disabled={resolved} className={`w-full ${inputCls}`} />
        </Field>
        {!resolved && canRefund && (
          <Field label="Refund to rider ($, optional)" hint={`Already refunded on this trip: ${money(d.trip.refundCents)}`}>
            <input value={refund} onChange={(e) => setRefund(e.target.value)} placeholder="0.00" className={`w-40 ${inputCls}`} />
          </Field>
        )}
        {!resolved && !canRefund && d.trip && !d.trip.paidOnline && <div className="text-xs text-muted">Not paid online — no card refund possible.</div>}
        {resolved && (
          <div className="text-xs text-muted">
            Resolved {dateTime(d.resolvedAt)}
            {d.refundCents ? ` · refunded ${money(d.refundCents)}` : ""}
          </div>
        )}
        {error && <div className="text-sm text-danger">{error}</div>}
        <div className="flex justify-end gap-2 pt-2">
          {busy && <Loader2 className="h-4 w-4 animate-spin text-primary self-center" />}
          {resolved ? (
            <button className={btn.ghost} disabled={busy} onClick={() => void save("open")}>Reopen</button>
          ) : (
            <>
              {d.status === "open" && (
                <button className={btn.ghost} disabled={busy} onClick={() => void save("in_review")}>Start review</button>
              )}
              <button className={btn.primary} disabled={busy} onClick={() => void save("resolved")}>Resolve & notify rider</button>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}
