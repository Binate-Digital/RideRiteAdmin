import { useEffect, useState } from "react";

type Props = {
  open: boolean;
  title?: string;
  driverName?: string;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  busy?: boolean;
};

export function RejectReasonModal({
  open,
  title = "Reject driver",
  driverName,
  onClose,
  onConfirm,
  busy = false,
}: Props) {
  const [reason, setReason] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setReason("");
      setLocalError(null);
    }
  }, [open]);

  if (!open) return null;

  const submit = () => {
    const trimmed = reason.trim();
    if (trimmed.length < 5) {
      setLocalError("Reason must be at least 5 characters");
      return;
    }
    if (trimmed.length > 500) {
      setLocalError("Reason must be under 500 characters");
      return;
    }
    onConfirm(trimmed);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Close"
        onClick={busy ? undefined : onClose}
      />
      <div className="relative w-full max-w-md rounded-2xl border border-border bg-surface p-5 shadow-xl">
        <h2 className="text-display text-2xl tracking-wide">{title}</h2>
        {driverName && <p className="mt-1 text-sm text-muted">{driverName}</p>}
        <label className="mt-4 block text-xs font-semibold uppercase tracking-wider text-muted">
          Rejection reason
        </label>
        <textarea
          value={reason}
          onChange={(e) => {
            setReason(e.target.value);
            setLocalError(null);
          }}
          rows={4}
          autoFocus
          placeholder="Explain why this driver is being rejected…"
          className="mt-1.5 w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary resize-y"
        />
        {localError && <p className="mt-2 text-sm text-danger">{localError}</p>}
        <div className="mt-4 flex justify-end gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={onClose}
            className="rounded-lg border border-border px-3 py-2 text-sm text-muted hover:text-foreground disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={submit}
            className="rounded-lg bg-danger px-3 py-2 text-sm font-bold text-white disabled:opacity-50"
          >
            {busy ? "Rejecting…" : "Confirm reject"}
          </button>
        </div>
      </div>
    </div>
  );
}
