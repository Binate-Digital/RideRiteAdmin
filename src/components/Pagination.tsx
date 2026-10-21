type Props = {
  page: number;
  totalPages: number;
  total: number;
  limit: number;
  onPageChange: (page: number) => void;
  disabled?: boolean;
};

export function Pagination({ page, totalPages, total, limit, onPageChange, disabled }: Props) {
  const from = total === 0 ? 0 : (page - 1) * limit + 1;
  const to = Math.min(page * limit, total);

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 border-t border-border">
      <div className="text-xs text-muted">
        Showing {from}–{to} of {total}
      </div>
      <div className="flex items-center gap-2">
        <button
          type="button"
          disabled={disabled || page <= 1}
          onClick={() => onPageChange(page - 1)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-40"
        >
          Prev
        </button>
        <span className="text-xs text-muted">
          Page {page} / {totalPages}
        </span>
        <button
          type="button"
          disabled={disabled || page >= totalPages}
          onClick={() => onPageChange(page + 1)}
          className="rounded-md border border-border px-3 py-1.5 text-xs font-semibold text-muted hover:text-foreground disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </div>
  );
}
