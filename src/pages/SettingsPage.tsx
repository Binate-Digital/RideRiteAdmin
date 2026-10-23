import { useEffect, useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import { adminApi, errorMessage, type Settings } from "@/lib/api";
import { dateTime } from "@/lib/format";
import { can } from "@/lib/session";
import { btn, ConfirmDialog, ErrorBanner, inputCls, Notice, PageHeader, Section, Spinner } from "@/components/ui";

type Unit = "cents" | "rate" | "int" | "fraction";
type FieldDef = { path: string; label: string; unit: Unit; hint?: string };

const VEHICLES = [
  ["sedan", "Sedan"],
  ["suv", "SUV"],
  ["truck", "Truck"],
] as const;

const GROUPS: { title: string; note?: string; fields: FieldDef[] }[] = [
  {
    title: "Ride fares",
    note: "Applies to new estimates and bookings. Booked trips keep the fare they were quoted.",
    fields: [
      ...VEHICLES.flatMap(([v, name]) => [
        { path: `fares.${v}.baseCents`, label: `${name} base fare`, unit: "cents" as Unit },
        { path: `fares.${v}.perMileCents`, label: `${name} per mile`, unit: "cents" as Unit },
        { path: `fares.${v}.perMinuteCents`, label: `${name} per minute`, unit: "cents" as Unit },
      ]),
      { path: "fares.bookingFeeCents", label: "Booking fee", unit: "cents" },
      { path: "fares.minimumFareCents", label: "Minimum fare (meter)", unit: "cents" },
      { path: "fares.serviceFeeRate", label: "Service fee", unit: "rate" },
      { path: "fares.taxRate", label: "Tax rate", unit: "rate" },
    ],
  },
  {
    title: "Cancellation fee rules",
    note: "Riders pay the fee when they cancel after the driver is en route, unless within the grace window.",
    fields: [
      { path: "cancellation.feeCents", label: "Cancellation fee", unit: "cents", hint: "capped at the fare; paid to the driver" },
      { path: "cancellation.graceSeconds", label: "Grace window (seconds after driver sets off)", unit: "int", hint: "0 = fee as soon as the driver is en route" },
    ],
  },
  {
    title: "Commission",
    fields: [
      { path: "commission.platformRate", label: "Ride commission (of base fare)", unit: "rate" },
      { path: "commission.rentalRate", label: "Peer rental commission", unit: "rate" },
      { path: "commission.chauffeurRate", label: "Chauffeur commission", unit: "rate" },
    ],
  },
  {
    title: "Chauffeur hourly rates",
    fields: VEHICLES.map(([v, name]) => ({ path: `chauffeurHourlyCents.${v}`, label: `${name} per hour`, unit: "cents" as Unit })),
  },
  {
    title: "Monthly bonus",
    fields: [
      { path: "bonus.minTrips", label: "Minimum completed trips", unit: "int" },
      { path: "bonus.minOnTimeRate", label: "Minimum on-time rate", unit: "fraction" },
      { path: "bonus.minSafeScore", label: "Minimum safe-driving score", unit: "int" },
      { path: "bonus.onTimeGraceMinutes", label: "On-time grace (minutes)", unit: "int" },
      { path: "bonus.amountCents", label: "Bonus amount", unit: "cents" },
    ],
  },
  {
    title: "Dispatch",
    fields: [{ path: "dispatch.offerSeconds", label: "Seconds a driver has to accept an offer", unit: "int" }],
  },
];

const getAt = (obj: any, path: string) => path.split(".").reduce((o, k) => o?.[k], obj);
function setAt(obj: any, path: string, value: unknown) {
  const keys = path.split(".");
  let o = obj;
  for (const k of keys.slice(0, -1)) o = o[k] ??= {};
  o[keys[keys.length - 1]] = value;
}

const toInput = (v: number, unit: Unit) =>
  unit === "cents" ? (v / 100).toFixed(2) : unit === "rate" || unit === "fraction" ? String(Math.round(v * 10000) / 100) : String(v);

function fromInput(raw: string, unit: Unit): number | null {
  const n = Number(raw.replace(/[$,%\s]/g, ""));
  if (!Number.isFinite(n) || n < 0) return null;
  if (unit === "cents") return Math.round(n * 100);
  if (unit === "rate" || unit === "fraction") return Math.round(n * 100) / 10000;
  return Math.round(n);
}

const suffix = (unit: Unit) => (unit === "cents" ? "$" : unit === "rate" || unit === "fraction" ? "%" : "");

/** TRD 6.8 cancellation fee rules + fares, commissions, chauffeur rates, bonus and dispatch settings. */
export function SettingsPage() {
  const [data, setData] = useState<{ settings: Settings; defaults: Settings; updatedAt: string | null } | null>(null);
  const [values, setValues] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [resetOpen, setResetOpen] = useState(false);
  const editable = can("settings:write");
  const fields = useMemo(() => GROUPS.flatMap((g) => g.fields), []);

  const apply = (d: { settings: Settings; defaults: Settings; updatedAt: string | null }) => {
    setData(d);
    setValues(Object.fromEntries(fields.map((f) => [f.path, toInput(getAt(d.settings, f.path), f.unit)])));
  };

  useEffect(() => {
    adminApi.settings().then(apply).catch((e) => setError(errorMessage(e)));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;

  const save = async () => {
    const patch: Record<string, any> = {};
    for (const f of fields) {
      const n = fromInput(values[f.path] ?? "", f.unit);
      if (n == null) return setError(`${f.label}: enter a valid number`);
      if (n !== getAt(data.settings, f.path)) setAt(patch, f.path, n);
    }
    if (!Object.keys(patch).length) return setNotice("Nothing changed.");
    setBusy(true);
    setError(null);
    try {
      const res = await adminApi.updateSettings(patch);
      apply({ ...data, settings: res.settings, updatedAt: new Date().toISOString() });
      setNotice(`Saved ${res.changes.length} change(s): ${res.changes.map((c) => c.path).join(", ")}`);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      <PageHeader
        title="SETTINGS"
        subtitle={`Platform pricing and rules · last changed ${dateTime(data.updatedAt)}`}
        actions={
          editable ? (
            <>
              <button className={btn.ghost} onClick={() => setResetOpen(true)}>Reset to defaults</button>
              <button className={btn.primary} disabled={busy} onClick={() => void save()}>
                {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save changes
              </button>
            </>
          ) : null
        }
      />
      {!editable && <Notice message="Read only — your admin role can't change settings." />}
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />
      <div className="grid xl:grid-cols-2 gap-4">
        {GROUPS.map((g) => (
          <Section key={g.title} title={g.title}>
            {g.note && <p className="text-xs text-muted mb-3">{g.note}</p>}
            <div className="grid sm:grid-cols-2 gap-3">
              {g.fields.map((f) => {
                const def = getAt(data.defaults, f.path);
                const changed = fromInput(values[f.path] ?? "", f.unit) !== def;
                return (
                  <label key={f.path} className="block">
                    <span className="text-xs font-semibold uppercase tracking-wider text-muted">{f.label}</span>
                    <div className="mt-1 flex items-center gap-2">
                      <span className="w-3 text-xs text-muted">{suffix(f.unit)}</span>
                      <input
                        value={values[f.path] ?? ""}
                        disabled={!editable}
                        onChange={(e) => setValues((v) => ({ ...v, [f.path]: e.target.value }))}
                        className={`w-full ${inputCls} ${changed ? "border-warning/60" : ""}`}
                        inputMode="decimal"
                      />
                    </div>
                    <span className="mt-1 block text-[11px] text-muted">
                      default {suffix(f.unit) === "$" ? "$" : ""}
                      {toInput(def, f.unit)}
                      {suffix(f.unit) === "%" ? "%" : ""}
                      {f.hint ? ` · ${f.hint}` : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </Section>
        ))}
      </div>
      <ConfirmDialog
        open={resetOpen}
        title="Reset to defaults"
        danger
        message="Every setting goes back to the server's env / built-in defaults. This is audited."
        onClose={() => setResetOpen(false)}
        onConfirm={async () => {
          const res = await adminApi.updateSettings({ reset: true });
          apply({ ...data, settings: res.settings, updatedAt: new Date().toISOString() });
          setNotice("Settings reset to defaults.");
        }}
      />
    </div>
  );
}
