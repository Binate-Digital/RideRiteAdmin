import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { ApiError } from "@/lib/api";

type Col = { key: string; label: string; render?: (row: any) => React.ReactNode };

export function GenericListPage({
  title,
  subtitle,
  load,
  columns,
  actions,
}: {
  title: string;
  subtitle?: string;
  load: () => Promise<any[]>;
  columns: Col[];
  actions?: (row: any, reload: () => void) => React.ReactNode;
}) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const reload = () => {
    setLoading(true);
    setError(null);
    load()
      .then(setRows)
      .catch((e) => setError(e instanceof ApiError ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    reload();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-display text-4xl tracking-wide">{title}</h1>
        {subtitle && <p className="text-sm text-muted mt-1">{subtitle}</p>}
      </div>
      <div className="rounded-xl border border-border bg-surface overflow-hidden">
        {loading && (
          <div className="p-8 grid place-items-center">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
          </div>
        )}
        {error && <div className="p-4 text-sm text-danger">{error}</div>}
        {!loading && (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-xs uppercase tracking-wider text-muted border-b border-border">
                <tr>
                  {columns.map((c) => (
                    <th key={c.key} className="px-4 py-3 font-bold">
                      {c.label}
                    </th>
                  ))}
                  {actions && <th className="px-4 py-3 font-bold">Actions</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((row) => (
                  <tr key={row.id || row._id || JSON.stringify(row)}>
                    {columns.map((c) => (
                      <td key={c.key} className="px-4 py-3 align-top">
                        {c.render ? c.render(row) : String(row[c.key] ?? "—")}
                      </td>
                    ))}
                    {actions && <td className="px-4 py-3">{actions(row, reload)}</td>}
                  </tr>
                ))}
                {rows.length === 0 && (
                  <tr>
                    <td className="px-4 py-6 text-muted" colSpan={columns.length + (actions ? 1 : 0)}>
                      No records.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
