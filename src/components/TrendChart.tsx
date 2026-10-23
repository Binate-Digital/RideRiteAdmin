import { useState } from "react";

/**
 * Tiny single-series bar chart (inline SVG, no chart library): one bar per day, rounded top,
 * recessive baseline, hover tooltip. One measure per chart — trips and money get separate
 * charts rather than a dual axis.
 */
export function TrendChart({
  title,
  points,
  format = (v) => String(v),
}: {
  title: string;
  points: { date: string; value: number }[];
  format?: (v: number) => string;
}) {
  const [hover, setHover] = useState<number | null>(null);
  const W = 600;
  const H = 160;
  const PAD = { top: 12, bottom: 22, left: 4, right: 4 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const slot = (W - PAD.left - PAD.right) / Math.max(points.length, 1);
  const barW = Math.max(3, Math.min(28, slot - 4));
  const plotH = H - PAD.top - PAD.bottom;
  const total = points.reduce((a, p) => a + p.value, 0);
  const labelEvery = points.length > 14 ? 5 : 1;
  const hovered = hover != null ? points[hover] : null;

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex items-baseline justify-between gap-2">
        <div className="text-[11px] font-bold uppercase tracking-wider text-muted">{title}</div>
        <div className="text-xs text-muted">
          {hovered ? (
            <>
              <span className="text-foreground font-semibold">{format(hovered.value)}</span> on {hovered.date}
            </>
          ) : (
            <>
              Total <span className="text-foreground font-semibold">{format(total)}</span>
            </>
          )}
        </div>
      </div>
      <svg viewBox={`0 0 ${W} ${H}`} className="mt-2 w-full h-40" role="img" aria-label={`${title}: ${format(total)} total`} onMouseLeave={() => setHover(null)}>
        <line x1={PAD.left} x2={W - PAD.right} y1={H - PAD.bottom} y2={H - PAD.bottom} stroke="var(--color-border)" strokeWidth="1" />
        {points.map((p, i) => {
          const h = (p.value / max) * plotH;
          const x = PAD.left + i * slot + (slot - barW) / 2;
          const y = H - PAD.bottom - h;
          const r = Math.min(4, barW / 2, h);
          return (
            <g key={p.date} onMouseEnter={() => setHover(i)}>
              {/* Hit target: the whole column, bigger than the bar */}
              <rect x={PAD.left + i * slot} y={PAD.top} width={slot} height={plotH} fill="transparent" />
              {h > 0 && (
                <path
                  d={`M${x},${H - PAD.bottom} V${y + r} Q${x},${y} ${x + r},${y} H${x + barW - r} Q${x + barW},${y} ${x + barW},${y + r} V${H - PAD.bottom} Z`}
                  fill="var(--color-primary)"
                  opacity={hover == null || hover === i ? 1 : 0.45}
                />
              )}
              {i % labelEvery === 0 && (
                <text x={x + barW / 2} y={H - 6} textAnchor="middle" fontSize="10" fill="var(--color-muted)">
                  {p.date.slice(5)}
                </text>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
