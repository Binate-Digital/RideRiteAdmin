import { useCallback, useEffect, useRef, useState } from "react";
import { errorMessage } from "@/lib/api";

type PageResult<T> = { rows: T[]; total: number; totalPages: number; extra?: any };

/**
 * Server-side paginated list: reloads when `deps` (filters) change, resets to page 1 on a
 * filter change, and ignores responses that arrive after a newer request.
 */
export function usePagedList<T>(
  load: (page: number) => Promise<PageResult<T>>,
  deps: unknown[],
) {
  const [page, setPage] = useState(1);
  const [rows, setRows] = useState<T[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [extra, setExtra] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const seq = useRef(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  const fetchPage = useCallback(async (p: number) => {
    const id = ++seq.current;
    setLoading(true);
    setError(null);
    try {
      const res = await loadRef.current(p);
      if (id !== seq.current) return;
      setRows(res.rows);
      setTotal(res.total);
      setTotalPages(res.totalPages);
      setExtra(res.extra ?? null);
    } catch (e) {
      if (id === seq.current) setError(errorMessage(e, "Failed to load"));
    } finally {
      if (id === seq.current) setLoading(false);
    }
  }, []);

  // Filters changed → back to page 1
  const depsKey = JSON.stringify(deps);
  const firstRun = useRef(true);
  useEffect(() => {
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }
    setPage(1);
    void fetchPage(1);
  }, [depsKey, fetchPage]);

  useEffect(() => {
    void fetchPage(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page]);

  return {
    rows,
    setRows,
    total,
    totalPages,
    extra,
    page,
    setPage,
    loading,
    error,
    setError,
    reload: () => fetchPage(page),
  };
}
