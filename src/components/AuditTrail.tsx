import { dateTime } from "@/lib/format";

/** Compact audit list (user / driver detail pages). */
export function AuditTrail({ logs }: { logs: any[] }) {
  if (!logs?.length) return <div className="text-sm text-muted">No admin actions recorded.</div>;
  return (
    <div className="divide-y divide-border max-h-80 overflow-auto">
      {logs.map((l) => (
        <div key={l.id} className="py-2 text-xs">
          <span className="text-muted">{dateTime(l.createdAt)}</span> · <span className="font-semibold">{l.action}</span> ·{" "}
          {l.actorName || l.actorEmail || "system"}
          {l.meta?.reason ? <span className="text-muted"> — {String(l.meta.reason)}</span> : null}
          {l.meta?.note ? <span className="text-muted"> — {String(l.meta.note)}</span> : null}
        </div>
      ))}
    </div>
  );
}
