import { useEffect, useState, type ReactNode } from "react";
import { Download, Loader2, Search, X } from "lucide-react";
import { Pagination } from "@/components/Pagination";
import { errorMessage } from "@/lib/api";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";

/** Shared admin building blocks in the panel's existing look (Tailwind tokens from index.css). */

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="text-display text-4xl tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  );
}

export function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-border bg-surface ${className}`}>{children}</div>;
}

export function Stat({ label, value, sub, tone }: { label: string; value: ReactNode; sub?: ReactNode; tone?: "danger" | "warning" }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{label}</div>
      <div className={`mt-1 text-display text-3xl ${tone === "danger" ? "text-danger" : tone === "warning" ? "text-warning" : "text-primary"}`}>{value}</div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

const BADGE_TONES: Record<string, string> = {
  good: "border-success/40 text-success",
  bad: "border-danger/40 text-danger",
  warn: "border-warning/40 text-warning",
  info: "border-primary/40 text-primary",
  muted: "border-border text-muted",
};

const STATUS_TONE: Record<string, keyof typeof BADGE_TONES> = {
  active: "good",
  approved: "good",
  completed: "good",
  paid: "good",
  succeeded: "good",
  resolved: "good",
  disbursed: "good",
  confirmed: "info",
  in_progress: "info",
  in_review: "info",
  scheduled: "info",
  driver_assigned: "info",
  en_route: "info",
  arrived: "info",
  accepted: "info",
  requested: "warn",
  pending: "warn",
  pending_review: "warn",
  pending_payment: "warn",
  open: "warn",
  processing: "warn",
  refund_pending: "warn",
  past_due: "warn",
  incomplete: "muted",
  suspended: "bad",
  deactivated: "bad",
  deleted: "bad",
  rejected: "bad",
  cancelled: "bad",
  canceled: "bad",
  failed: "bad",
  no_drivers: "bad",
  paused: "muted",
  expired: "muted",
  inactive: "muted",
};

export function Badge({ children, tone }: { children: ReactNode; tone?: keyof typeof BADGE_TONES }) {
  const key = tone || STATUS_TONE[String(children)] || "muted";
  return (
    <span className={`inline-flex rounded-md border px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${BADGE_TONES[key]}`}>
      {typeof children === "string" ? children.replace(/_/g, " ") : children}
    </span>
  );
}

export function Pills<T extends string>({ value, options, onChange }: { value: T; options: readonly T[] | { id: T; label: string }[]; onChange: (v: T) => void }) {
  const list = (options as any[]).map((o) => (typeof o === "string" ? { id: o, label: o.replace(/_/g, " ") } : o)) as { id: T; label: string }[];
  return (
    <div className="flex gap-2 flex-wrap">
      {list.map((o) => (
        <button
          key={o.id}
          type="button"
          onClick={() => onChange(o.id)}
          className={`rounded-md px-3 py-2 text-xs font-bold uppercase tracking-wider border ${
            value === o.id ? "bg-primary text-primary-foreground border-primary" : "border-border text-muted hover:text-foreground"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Debounced search box; calls onChange with the settled value. */
export function SearchBox({ placeholder, onChange }: { placeholder: string; onChange: (q: string) => void }) {
  const [q, setQ] = useState("");
  const debounced = useDebouncedValue(q, 350);
  useEffect(() => onChange(debounced.trim()), [debounced, onChange]);
  return (
    <div className="flex-1 min-w-[200px] flex items-center gap-2 rounded-lg border border-border bg-background px-3 py-2">
      <Search className="h-4 w-4 text-muted shrink-0" />
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder={placeholder} className="flex-1 bg-transparent outline-none text-sm" />
    </div>
  );
}

export function FilterBar({ children }: { children: ReactNode }) {
  return <div className="p-4 border-b border-border flex flex-col lg:flex-row gap-3 lg:items-center flex-wrap">{children}</div>;
}

export const inputCls =
  "rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary disabled:opacity-60";
export const btn = {
  primary: "inline-flex items-center justify-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground disabled:opacity-40",
  ghost: "inline-flex items-center justify-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-bold text-muted hover:text-foreground disabled:opacity-40",
  danger: "inline-flex items-center justify-center gap-1.5 rounded-md border border-danger/40 px-3 py-1.5 text-xs font-bold text-danger disabled:opacity-40",
  link: "text-xs font-bold text-primary hover:underline disabled:opacity-40",
};

export function Spinner() {
  return (
    <div className="p-8 grid place-items-center">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
    </div>
  );
}

export function ErrorBanner({ error, onClose }: { error: string | null; onClose?: () => void }) {
  if (!error) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-danger/40 bg-danger/10 px-3 py-2 text-sm text-danger">
      <span>{error}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export function Notice({ message, onClose }: { message: string | null; onClose?: () => void }) {
  if (!message) return null;
  return (
    <div className="flex items-start justify-between gap-3 rounded-lg border border-success/40 bg-success/10 px-3 py-2 text-sm text-success">
      <span>{message}</span>
      {onClose && (
        <button type="button" onClick={onClose} aria-label="Dismiss">
          <X className="h-4 w-4" />
        </button>
      )}
    </div>
  );
}

export type Column<T> = { key: string; label: string; render?: (row: T) => ReactNode; className?: string };

/** Table with server-side pagination (pairs with usePagedList). */
export function DataTable<T extends Record<string, any>>({
  columns,
  rows,
  loading,
  actions,
  empty = "No records.",
  paging,
  rowKey = (r: T) => r.id || r._id || JSON.stringify(r),
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  actions?: (row: T) => ReactNode;
  empty?: string;
  paging?: { page: number; totalPages: number; total: number; limit: number; onPageChange: (p: number) => void };
  rowKey?: (r: T) => string;
}) {
  return (
    <>
      {loading && rows.length === 0 ? (
        <Spinner />
      ) : (
        <div className={`overflow-x-auto ${loading ? "opacity-60" : ""}`}>
          <table className="w-full text-sm">
            <thead className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
              <tr>
                {columns.map((c) => (
                  <th key={c.key} className="px-4 py-3 font-bold whitespace-nowrap">
                    {c.label}
                  </th>
                ))}
                {actions && <th className="px-4 py-3 font-bold">Actions</th>}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((row) => (
                <tr key={rowKey(row)} className="hover:bg-surface-2/40">
                  {columns.map((c) => (
                    <td key={c.key} className={`px-4 py-3 align-top ${c.className || ""}`}>
                      {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                    </td>
                  ))}
                  {actions && <td className="px-4 py-3 align-top whitespace-nowrap">{actions(row)}</td>}
                </tr>
              ))}
              {rows.length === 0 && !loading && (
                <tr>
                  <td className="px-4 py-6 text-muted" colSpan={columns.length + (actions ? 1 : 0)}>
                    {empty}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}
      {paging && paging.total > 0 && (
        <Pagination
          page={paging.page}
          totalPages={paging.totalPages}
          total={paging.total}
          limit={paging.limit}
          onPageChange={paging.onPageChange}
          disabled={loading}
        />
      )}
    </>
  );
}

export function Modal({ open, title, subtitle, onClose, children, wide }: { open: boolean; title: string; subtitle?: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button type="button" className="absolute inset-0 bg-black/60" aria-label="Close" onClick={onClose} />
      <div className={`relative w-full ${wide ? "max-w-2xl" : "max-w-md"} max-h-[90vh] overflow-y-auto rounded-2xl border border-border bg-surface p-5 shadow-xl`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <h2 className="text-display text-2xl tracking-wide">{title}</h2>
            {subtitle && <p className="mt-1 text-sm text-muted">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="text-muted hover:text-foreground" aria-label="Close">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="mt-4">{children}</div>
      </div>
    </div>
  );
}

/**
 * Confirmation step for an action, optionally asking for a reason / amount. `onConfirm`
 * may throw: its error is shown in the dialog and the dialog stays open.
 */
export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  danger,
  reason,
  onClose,
  onConfirm,
  children,
}: {
  open: boolean;
  title: string;
  message?: ReactNode;
  confirmLabel?: string;
  danger?: boolean;
  /** Ask for a reason: { label, required min length, placeholder } */
  reason?: { label: string; minLength?: number; placeholder?: string };
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void> | void;
  children?: ReactNode;
}) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  useEffect(() => {
    if (open) {
      setText("");
      setError(null);
      setBusy(false);
    }
  }, [open]);
  if (!open) return null;
  const submit = async () => {
    const trimmed = text.trim();
    if (reason?.minLength && trimmed.length < reason.minLength) {
      setError(`${reason.label} must be at least ${reason.minLength} characters`);
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await onConfirm(trimmed);
      onClose();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal open={open} title={title} onClose={busy ? () => {} : onClose}>
      {message && <div className="text-sm text-muted">{message}</div>}
      {children}
      {reason && (
        <>
          <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">{reason.label}</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={3}
            autoFocus
            placeholder={reason.placeholder}
            className={`mt-1.5 w-full resize-y ${inputCls}`}
          />
        </>
      )}
      {error && <p className="mt-2 text-sm text-danger">{error}</p>}
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" disabled={busy} onClick={onClose} className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50">
          Cancel
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={submit}
          className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-bold disabled:opacity-50 ${danger ? "bg-danger text-white" : "bg-primary text-primary-foreground"}`}
        >
          {busy && <Loader2 className="h-4 w-4 animate-spin" />}
          {confirmLabel}
        </button>
      </div>
    </Modal>
  );
}

export function ExportButtons({ onExport }: { onExport: (format: "csv" | "xlsx") => Promise<void> }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = async (f: "csv" | "xlsx") => {
    setBusy(f);
    setError(null);
    try {
      await onExport(f);
    } catch (e) {
      setError(errorMessage(e, "Export failed"));
    } finally {
      setBusy(null);
    }
  };
  return (
    <div className="flex items-center gap-2">
      {error && <span className="text-xs text-danger">{error}</span>}
      {(["csv", "xlsx"] as const).map((f) => (
        <button
          key={f}
          type="button"
          disabled={Boolean(busy)}
          onClick={() => void run(f)}
          className="inline-flex items-center gap-2 rounded-lg border border-border px-3 py-2 text-xs font-bold uppercase text-muted hover:text-foreground disabled:opacity-50"
        >
          {busy === f ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {f === "csv" ? "CSV" : "Excel"}
        </button>
      ))}
    </div>
  );
}

export function KeyValue({ rows }: { rows: [string, ReactNode][] }) {
  return (
    <dl className="grid grid-cols-[minmax(110px,auto)_1fr] gap-x-4 gap-y-1.5 text-sm">
      {rows.map(([k, v]) => (
        <div key={k} className="contents">
          <dt className="text-muted text-xs uppercase tracking-wider pt-0.5">{k}</dt>
          <dd className="min-w-0 break-words">{v ?? "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

export function Section({ title, children, actions }: { title: string; children: ReactNode; actions?: ReactNode }) {
  return (
    <Panel className="p-4">
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="font-bold">{title}</div>
        {actions}
      </div>
      {children}
    </Panel>
  );
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="text-xs font-semibold uppercase tracking-wider text-muted">{label}</span>
      <div className="mt-1">{children}</div>
      {hint && <span className="mt-1 block text-[11px] text-muted">{hint}</span>}
    </label>
  );
}
