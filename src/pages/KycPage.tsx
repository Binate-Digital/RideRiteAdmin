import { useState } from "react";
import { Link } from "react-router-dom";
import { Check, X } from "lucide-react";
import { adminApi, type PlatformDriver } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime } from "@/lib/format";
import { can } from "@/lib/session";
import { Pagination } from "@/components/Pagination";
import { Badge, btn, ConfirmDialog, ErrorBanner, Notice, PageHeader, Panel, Pills, Spinner } from "@/components/ui";
import { vehicleOf } from "@/pages/DriversPage";

const PAGE_SIZE = 10;

/**
 * KYC queue: submitted driver applications (profiles still being filled in are excluded),
 * plus approved drivers with re-uploaded documents or a vehicle change waiting.
 */
export function KycPage() {
  const [queue, setQueue] = useState<"pending" | "documents" | "vehicle_change">("pending");
  const [notice, setNotice] = useState<string | null>(null);
  const [target, setTarget] = useState<{ d: PlatformDriver; status: "approved" | "rejected" } | null>(null);
  const list = usePagedList<PlatformDriver>(
    async (page) => {
      const res = await adminApi.drivers({ status: queue, page, limit: PAGE_SIZE });
      return { rows: res.drivers, total: res.total, totalPages: res.totalPages };
    },
    [queue],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="KYC" subtitle="Driver verification queue" />
      <Pills
        value={queue}
        options={[
          { id: "pending", label: "applications" },
          { id: "documents", label: "documents" },
          { id: "vehicle_change", label: "vehicle changes" },
        ]}
        onChange={setQueue}
      />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <ErrorBanner error={list.error} />
      <Panel>
        {list.loading && list.rows.length === 0 && <Spinner />}
        <div className="divide-y divide-border">
          {list.rows.map((d) => {
            const files = Object.values(d.documents).flatMap((doc) => Object.entries(doc.files).filter(([, u]) => u)) as [string, string][];
            return (
              <div key={d.userId} className="p-4 space-y-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <div className="font-semibold">{d.fullName || "—"}</div>
                    <div className="text-xs text-muted">
                      {d.email || "no email"} · {vehicleOf(d)} · {d.vehicleType.toUpperCase()} · {d.vehiclePlate || "no plate"}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-1.5 items-center text-xs text-muted">
                      <Badge>{d.status}</Badge>
                      {Object.entries(d.documents).map(([k, doc]) => (
                        <span key={k}>
                          {k}: <span className={doc.status === "pending" ? "text-warning" : doc.status === "rejected" ? "text-danger" : ""}>{doc.status}</span>
                        </span>
                      ))}
                      <span>· submitted {dateTime(d.verificationSubmittedAt)}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Link to={`/drivers/${d.userId}`} className={btn.ghost}>Review documents</Link>
                    {can("drivers:approve") && queue === "pending" && (
                      <>
                        <button className={btn.primary} onClick={() => setTarget({ d, status: "approved" })}>
                          <Check className="h-3 w-3" /> Approve
                        </button>
                        <button className={btn.danger} onClick={() => setTarget({ d, status: "rejected" })}>
                          <X className="h-3 w-3" /> Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
                {files.length > 0 && (
                  <div className="flex gap-2 overflow-x-auto">
                    {files.map(([name, url]) => (
                      <a key={name} href={url} target="_blank" rel="noreferrer" title={name} className="shrink-0">
                        {/\.pdf($|\?)/i.test(url) ? (
                          <div className="h-16 w-24 grid place-items-center rounded border border-border text-[10px] text-muted">PDF</div>
                        ) : (
                          <img src={url} alt={name} className="h-16 w-24 rounded border border-border object-cover" loading="lazy" />
                        )}
                      </a>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
          {!list.loading && list.rows.length === 0 && <div className="p-6 text-sm text-muted">Nothing waiting for review.</div>}
        </div>
        {list.total > 0 && (
          <Pagination page={list.page} totalPages={list.totalPages} total={list.total} limit={PAGE_SIZE} onPageChange={list.setPage} disabled={list.loading} />
        )}
      </Panel>
      <ConfirmDialog
        open={Boolean(target)}
        title={target?.status === "approved" ? "Approve driver" : "Reject driver"}
        message={target?.d.fullName || target?.d.email}
        danger={target?.status === "rejected"}
        confirmLabel={target?.status === "approved" ? "Approve" : "Reject"}
        reason={target?.status === "rejected" ? { label: "Rejection reason", minLength: 5, placeholder: "Sent to the driver" } : undefined}
        onClose={() => setTarget(null)}
        onConfirm={async (reason) => {
          if (!target) return;
          await adminApi.setDriverStatus(target.d.userId, target.status, reason);
          setNotice(`${target.d.fullName || "Driver"} ${target.status}.`);
          await list.reload();
        }}
      />
    </div>
  );
}
