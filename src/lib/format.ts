export const money = (cents: number | null | undefined) =>
  `$${((cents || 0) / 100).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export const dateTime = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleString() : "—");
export const date = (v: string | Date | null | undefined) => (v ? new Date(v).toLocaleDateString() : "—");
export const pct = (rate: number | null | undefined, digits = 0) => `${((rate || 0) * 100).toFixed(digits)}%`;
export const shortId = (id: string | null | undefined) => (id ? `${id.slice(0, 8)}…` : "—");
export const label = (s: string | null | undefined) => (s ? s.replace(/_/g, " ") : "—");

/** "$12.34" → 1234 (null when not a valid non-negative amount). */
export function parseDollars(input: string): number | null {
  const n = Number(String(input).replace(/[$,\s]/g, ""));
  return Number.isFinite(n) && n >= 0 ? Math.round(n * 100) : null;
}

/** Trip payment method for display: offline methods are paid to the driver at drop-off. */
export const paymentMethodLabel = (m: string | null | undefined) =>
  m && ["cash", "venmo", "zelle"].includes(m) ? `${m} (pay on drop-off)` : label(m);
