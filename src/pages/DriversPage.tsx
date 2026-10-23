import { useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Check, X } from "lucide-react";
import { adminApi, type PlatformDriver } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { date } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, DataTable, ErrorBanner, ExportButtons, FilterBar, Notice, PageHeader, Panel, Pills, SearchBox } from "@/components/ui";

const PAGE_SIZE = 20;
const STATUSES = [
  { id: "all", label: "all" },
  { id: "pending", label: "submitted" },
  { id: "incomplete", label: "incomplete" },
  { id: "approved", label: "approved" },
  { id: "rejected", label: "rejected" },
  { id: "suspended", label: "suspended" },
  { id: "documents", label: "docs to review" },
  { id: "vehicle_change", label: "vehicle changes" },
] as const;
type Status = (typeof STATUSES)[number]["id"];

export const vehicleOf = (d: Pick<PlatformDriver, "vehicleYear" | "vehicleMake" | "vehicleModel">) =>
  [d.vehicleYear, d.vehicleMake, d.vehicleModel].filter(Boolean).join(" ") || "no vehicle";

/** TRD 6.3 driver management: every driver, with review queues and quick decisions. */
export function DriversPage() {
  const [params] = useSearchParams();
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<Status>((params.get("status") as Status) || "all");
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState<{ driver: PlatformDriver; action: "approved" | "rejected" | "suspended" } | null>(null);
  const filters = { q, status };
  const list = usePagedList<PlatformDriver>(
    async (page) => {
      const res = await adminApi.drivers({ ...filters, page, limit: PAGE_SIZE });
      return { rows: res.drivers, total: res.total, totalPages: res.totalPages };
    },
    [q, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="DRIVERS"
        subtitle="Approve applications, review documents and vehicle changes, suspend drivers"
        actions={can("users:export") ? <ExportButtons onExport={(f) => adminApi.exportDrivers(f, filters)} /> : null}
      />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Search name, email, phone, plate…" onChange={setQ} />
          <Pills value={status} options={STATUSES as unknown as { id: Status; label: string }[]} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0">
          <ErrorBanner error={list.error} onClose={() => list.setError(null)} />
        </div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          rowKey={(d) => d.userId}
          empty="No drivers match."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            {
              key: "fullName",
              label: "Driver",
              render: (d) => (
                <Link to={`/drivers/${d.userId}`}>
                  <div className="font-semibold hover:text-primary">{d.fullName || "—"}</div>
                  <div className="text-xs text-muted">{d.email || "no email"}</div>
                </Link>
              ),
            },
            {
              key: "vehicle",
              label: "Vehicle",
              render: (d) => (
                <div>
                  <div>{vehicleOf(d)}</div>
                  <div className="text-xs text-muted">
                    {d.vehicleType.toUpperCase()} · {d.vehiclePlate || "no plate"}
                  </div>
                </div>
              ),
            },
            {
              key: "status",
              label: "Status",
              render: (d) => (
                <div className="space-y-1">
                  <Badge>{d.status}</Badge>
                  {d.isOnline && <Badge tone="good">online</Badge>}
                  {d.reviewDecision?.reason && d.status === "rejected" && (
                    <div className="text-xs text-muted max-w-[220px] truncate" title={d.reviewDecision.reason}>{d.reviewDecision.reason}</div>
                  )}
                </div>
              ),
            },
            {
              key: "reviews",
              label: "To review",
              render: (d) => (
                <div className="text-xs space-y-0.5">
                  {d.documentsPending > 0 && <div className="text-warning">{d.documentsPending} document(s)</div>}
                  {d.pendingVehicleChange && <div className="text-warning">vehicle change → {d.pendingVehicleChange.vehiclePlate}</div>}
                  {!d.documentsPending && !d.pendingVehicleChange && <span className="text-muted">—</span>}
                </div>
              ),
            },
            { key: "submitted", label: "Submitted", render: (d) => date(d.verificationSubmittedAt || d.createdAt) },
          ]}
          actions={(d) => (
            <div className="flex gap-2">
              <Link to={`/drivers/${d.userId}`} className={btn.ghost}>Review</Link>
              {can("drivers:approve") && d.status !== "approved" && d.status !== "suspended" && d.status !== "deactivated" && (
                <button className={btn.primary} onClick={() => setTarget({ driver: d, action: "approved" })}>
                  <Check className="h-3 w-3" /> Approve
                </button>
              )}
              {can("drivers:approve") && (d.status === "pending" || d.status === "approved") && (
                <button className={btn.danger} onClick={() => setTarget({ driver: d, action: "rejected" })}>
                  <X className="h-3 w-3" /> Reject
                </button>
              )}
              {can("drivers:approve") && d.status === "approved" && (
                <button className={btn.danger} onClick={() => setTarget({ driver: d, action: "suspended" })}>Suspend</button>
              )}
            </div>
          )}
        />
      </Panel>

      <ConfirmDialog
        open={Boolean(target)}
        title={target?.action === "approved" ? "Approve driver" : target?.action === "rejected" ? "Reject driver" : "Suspend driver"}
        message={
          <>
            <div className="font-semibold text-foreground">{target?.driver.fullName || target?.driver.email}</div>
            {target?.action === "approved"
              ? "Uploaded documents are marked approved and the driver is notified."
              : target?.action === "rejected"
                ? "The driver is notified with this reason and can no longer sign in."
                : "The driver goes offline, is signed out and notified."}
          </>
        }
        danger={target?.action !== "approved"}
        confirmLabel={target?.action === "approved" ? "Approve" : target?.action === "rejected" ? "Reject" : "Suspend"}
        reason={target?.action === "approved" ? undefined : { label: "Reason", minLength: target?.action === "rejected" ? 5 : 3, placeholder: "Sent to the driver" }}
        onClose={() => setTarget(null)}
        onConfirm={async (reason) => {
          if (!target) return;
          await adminApi.setDriverStatus(target.driver.userId, target.action, reason);
          setNotice(`${target.driver.fullName || "Driver"}: ${target.action}.`);
          await list.reload();
        }}
      />
    </div>
  );
}
