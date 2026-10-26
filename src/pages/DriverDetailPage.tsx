import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink, FileText } from "lucide-react";
import { adminApi, errorMessage, type DocumentInfo } from "@/lib/api";
import { date, dateTime, label, money, pct } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, ErrorBanner, KeyValue, Notice, PageHeader, Section, Spinner } from "@/components/ui";
import { AuditTrail } from "@/components/AuditTrail";
import { MiniTable } from "@/pages/UserDetailPage";
import { vehicleOf } from "@/pages/DriversPage";

type Pending =
  | { kind: "account"; status: "approved" | "rejected" | "suspended" }
  | { kind: "reactivate" }
  | { kind: "doc"; doc: string; status: "approved" | "rejected" }
  | { kind: "vehicle"; action: "approve" | "reject" }
  | null;

const FILE_LABELS: Record<string, string> = {
  licenseFrontUrl: "License — front",
  licenseBackUrl: "License — back",
  registrationDocUrl: "Registration",
  insuranceDocUrl: "Insurance",
};

/**
 * Driver documents are private: the profile holds a storage key, and each view asks the API
 * for a short-lived signed URL (needs the drivers:documents permission; every view is audited).
 */
function DocFile({ userId, name, stored }: { userId: string; name: string; stored: string | null }) {
  const [view, setView] = useState<{ url: string; mimetype: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const allowed = can("drivers:documents");

  useEffect(() => {
    if (!stored || !allowed) return;
    let cancelled = false;
    adminApi
      .driverDocumentUrl(userId, name)
      .then((r) => !cancelled && setView({ url: r.url, mimetype: r.mimetype }))
      .catch((e) => !cancelled && setError(errorMessage(e)));
    return () => {
      cancelled = true;
    };
  }, [userId, name, stored, allowed]);

  const caption = FILE_LABELS[name] || name;
  if (!stored) return <div className="rounded-lg border border-dashed border-border p-4 text-xs text-muted">{caption}: not uploaded</div>;
  if (!allowed) return <div className="rounded-lg border border-border p-4 text-xs text-muted">{caption}: uploaded (your role can&apos;t open documents)</div>;
  if (error) return <div className="rounded-lg border border-border p-4 text-xs text-danger">{caption}: {error}</div>;

  // A fresh link per click: the one used for the preview may have expired meanwhile
  const open = async () => {
    try {
      const r = await adminApi.driverDocumentUrl(userId, name);
      window.open(r.url, "_blank", "noopener,noreferrer");
    } catch (e) {
      setError(errorMessage(e));
    }
  };
  const isPdf = view?.mimetype === "application/pdf";
  return (
    <button type="button" onClick={() => void open()} className="block w-full text-left rounded-lg border border-border overflow-hidden hover:border-primary">
      {!view ? (
        <div className="h-36 grid place-items-center bg-background">
          <Spinner />
        </div>
      ) : isPdf ? (
        <div className="h-36 grid place-items-center bg-background text-muted">
          <FileText className="h-8 w-8" />
        </div>
      ) : (
        <img src={view.url} alt={caption} className="h-36 w-full object-cover bg-background" />
      )}
      <div className="flex items-center justify-between px-2 py-1.5 text-xs">
        <span>{caption}</span>
        <ExternalLink className="h-3 w-3 text-muted" />
      </div>
    </button>
  );
}

/** TRD 6.3 driver detail: documents (images), document & vehicle-change review, account decisions. */
export function DriverDetailPage() {
  const { userId = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState<Pending>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.driver(userId));
    } catch (e) {
      setError(errorMessage(e, "Failed to load driver"));
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const d = data.driver;
  const canReview = can("drivers:approve");
  const docs = Object.entries(d.documents) as [string, DocumentInfo][];
  const change = d.pendingVehicleChange;

  return (
    <div className="space-y-4">
      <Link to="/drivers" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Drivers
      </Link>
      <PageHeader
        title={(d.fullName || "Driver").toUpperCase()}
        subtitle={`${d.email || "no email"} · ${d.phone || "no phone"}`}
        actions={
          canReview ? (
            <>
              {d.status !== "approved" && d.status !== "suspended" && d.status !== "deactivated" && (
                <button className={btn.primary} onClick={() => setPending({ kind: "account", status: "approved" })}>Approve driver</button>
              )}
              {(d.status === "pending" || d.status === "approved" || d.status === "incomplete") && (
                <button className={btn.danger} onClick={() => setPending({ kind: "account", status: "rejected" })}>Reject</button>
              )}
              {d.status === "approved" && (
                <button className={btn.danger} onClick={() => setPending({ kind: "account", status: "suspended" })}>Suspend</button>
              )}
              {(d.status === "suspended" || d.status === "deactivated") && can("users:manage") && (
                <button className={btn.primary} onClick={() => setPending({ kind: "reactivate" })}>Reactivate</button>
              )}
              <Link to={`/users/${d.userId}`} className={btn.ghost}>User profile</Link>
            </>
          ) : (
            <Link to={`/users/${d.userId}`} className={btn.ghost}>User profile</Link>
          )
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="Status">
          <KeyValue
            rows={[
              ["Driver", <Badge key="s">{d.status}</Badge>],
              ["Verification", label(d.verificationStatus)],
              ["Online", d.isOnline ? "yes" : "no"],
              ["Last decision", d.reviewDecision ? `${d.reviewDecision.status} · ${dateTime(d.reviewDecision.at)}` : "—"],
              ["Reason", d.reviewDecision?.reason || "—"],
              ["Submitted", dateTime(d.verificationSubmittedAt)],
              ["Stripe Connect", d.stripeConnectPayoutsEnabled ? "payouts enabled" : d.stripeConnectAccountId ? "not ready" : "not set up"],
            ]}
          />
        </Section>
        <Section title="Vehicle">
          <KeyValue
            rows={[
              ["Vehicle", vehicleOf(d)],
              ["Type", d.vehicleType?.toUpperCase()],
              ["Plate", d.vehiclePlate || "—"],
              ["Color", d.vehicleColor || "—"],
              ["VIN", d.vehicleVin || "—"],
            ]}
          />
        </Section>
        <Section title="Identity & money">
          <KeyValue
            rows={[
              ["DOB", d.dateOfBirth || "—"],
              ["Address", [d.addressLine1, d.city, d.state, d.zip].filter(Boolean).join(", ") || "—"],
              ["License #", `${d.dlNumber || "—"} (${d.dlState || "—"})`],
              ["Insurance", `${d.insuranceCarrier || "—"} · ${d.insurancePolicyNumber || "—"}`],
              ["Membership", data.subscription ? `${data.subscription.plan} · ${data.subscription.status} · to ${date(data.subscription.currentPeriodEnd)}` : "none"],
              ["Pending payout", money(data.earnings.pendingCents)],
              ["Paid out", money(data.earnings.paidCents)],
            ]}
          />
        </Section>
      </div>

      <Section title="Documents">
        <div className="space-y-5">
          {docs.map(([key, doc]) => (
            <div key={key} className="border-b border-border pb-4 last:border-0 last:pb-0">
              <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
                <div className="flex items-center gap-2">
                  <span className="font-semibold capitalize">{doc.label}</span>
                  <Badge>{doc.status}</Badge>
                  {doc.expired && <Badge tone="bad">expired</Badge>}
                  <span className="text-xs text-muted">
                    expires {doc.expiresOn || "—"}
                    {doc.daysLeft != null && !doc.expired ? ` (${doc.daysLeft} days)` : ""}
                  </span>
                </div>
                {canReview && doc.status !== "missing" && (
                  <div className="flex gap-2">
                    {doc.status !== "approved" && (
                      <button className={btn.primary} onClick={() => setPending({ kind: "doc", doc: key, status: "approved" })}>Approve</button>
                    )}
                    {doc.status !== "rejected" && (
                      <button className={btn.danger} onClick={() => setPending({ kind: "doc", doc: key, status: "rejected" })}>Reject</button>
                    )}
                  </div>
                )}
              </div>
              {doc.note && <div className="mb-2 text-xs text-muted">Note: {doc.note}</div>}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {Object.entries(doc.files).map(([name, url]) => (
                  <DocFile key={name} userId={userId} name={name} stored={url} />
                ))}
              </div>
            </div>
          ))}
        </div>
      </Section>

      {(change || d.lastVehicleChangeReview) && (
        <Section title="Vehicle change">
          {change ? (
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="text-sm">
                <div>
                  <span className="text-muted">Current:</span> {vehicleOf(d)} · {d.vehicleType?.toUpperCase()} · {d.vehiclePlate}
                </div>
                <div className="mt-1">
                  <span className="text-muted">Requested:</span>{" "}
                  {[change.vehicleYear, change.vehicleMake, change.vehicleModel].filter(Boolean).join(" ")} · {String(change.vehicleType).toUpperCase()} ·{" "}
                  {change.vehiclePlate} {change.vehicleColor ? `· ${change.vehicleColor}` : ""}
                </div>
                <div className="mt-1 text-xs text-muted">Requested {dateTime(change.requestedAt)}</div>
              </div>
              {canReview && (
                <div className="flex gap-2">
                  <button className={btn.primary} onClick={() => setPending({ kind: "vehicle", action: "approve" })}>Approve change</button>
                  <button className={btn.danger} onClick={() => setPending({ kind: "vehicle", action: "reject" })}>Reject</button>
                </div>
              )}
            </div>
          ) : (
            <div className="text-sm text-muted">
              Last request {d.lastVehicleChangeReview.status} on {dateTime(d.lastVehicleChangeReview.at)}
              {d.lastVehicleChangeReview.note ? ` — ${d.lastVehicleChangeReview.note}` : ""}
            </div>
          )}
        </Section>
      )}

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Monthly bonuses">
          <MiniTable
            rows={data.bonuses}
            cols={[
              ["Month", (b: any) => b.monthKey],
              ["Trips", (b: any) => b.tripsCompleted],
              ["On time", (b: any) => pct(b.onTimeRate)],
              ["Safe score", (b: any) => b.safeDrivingScore],
              ["Status", (b: any) => <Badge>{b.status}</Badge>],
            ]}
          />
        </Section>
        <Section title="Maintenance">
          <MiniTable
            rows={data.maintenance}
            cols={[
              ["Service", (m: any) => m.title],
              ["Due", (m: any) => date(m.dueAt)],
              ["Cost", (m: any) => money(m.costCents)],
              ["Status", (m: any) => <Badge>{m.status}</Badge>],
            ]}
          />
        </Section>
      </div>
      <Section title="Recent trips">
        <MiniTable
          rows={data.trips}
          cols={[
            ["When", (t: any) => <Link className="text-primary" to={`/trips/${t.id}`}>{dateTime(t.createdAt)}</Link>],
            ["Route", (t: any) => `${t.pickupAddress} → ${t.destinationAddress}`],
            ["Status", (t: any) => <Badge>{t.status}</Badge>],
            ["Earned", (t: any) => money(t.driverEarningsCents)],
            ["Rating", (t: any) => t.riderRating ?? "—"],
          ]}
        />
      </Section>
      <Section title="Payouts">
        <MiniTable
          rows={data.payouts}
          cols={[
            ["When", (p: any) => dateTime(p.createdAt)],
            ["Amount", (p: any) => money(p.amountCents)],
            ["Status", (p: any) => <Badge>{p.status}</Badge>],
            ["Transfer", (p: any) => `${p.stripeTransferId || "—"}${p.simulated ? " (simulated)" : ""}`],
          ]}
        />
      </Section>
      <Section title="Audit trail">
        <AuditTrail logs={data.audit} />
      </Section>

      <ConfirmDialog
        open={Boolean(pending)}
        title={
          pending?.kind === "doc"
            ? `${pending.status === "approved" ? "Approve" : "Reject"} ${pending.doc}`
            : pending?.kind === "vehicle"
              ? `${pending.action === "approve" ? "Approve" : "Reject"} vehicle change`
              : pending?.kind === "reactivate"
                ? "Reactivate driver"
                : pending?.kind === "account"
                  ? `${pending.status === "approved" ? "Approve" : pending.status === "rejected" ? "Reject" : "Suspend"} driver`
                  : ""
        }
        danger={
          (pending?.kind === "doc" && pending.status === "rejected") ||
          (pending?.kind === "vehicle" && pending.action === "reject") ||
          (pending?.kind === "account" && pending.status !== "approved")
        }
        message={
          pending?.kind === "doc" && pending.status === "rejected"
            ? "The driver is asked to upload it again, with your note."
            : pending?.kind === "vehicle" && pending.action === "approve"
              ? "The requested vehicle becomes the driver's live vehicle (dispatch tier and plate)."
              : pending?.kind === "account" && pending.status === "rejected"
                ? "The driver is notified with this reason and can no longer sign in."
                : "The driver is notified."
        }
        reason={
          (pending?.kind === "doc" && pending.status === "rejected") ||
          (pending?.kind === "vehicle" && pending.action === "reject") ||
          (pending?.kind === "account" && pending.status !== "approved")
            ? {
                label: pending?.kind === "doc" ? "What's wrong with it" : "Reason",
                minLength: pending?.kind === "account" && pending.status === "rejected" ? 5 : 3,
                placeholder: "Sent to the driver",
              }
            : undefined
        }
        onClose={() => setPending(null)}
        onConfirm={async (reason) => {
          if (!pending) return;
          if (pending.kind === "doc") await adminApi.reviewDocument(d.userId, pending.doc, pending.status, reason);
          else if (pending.kind === "vehicle") await adminApi.reviewVehicleChange(d.userId, pending.action, reason);
          else if (pending.kind === "reactivate") await adminApi.setUserStatus(d.userId, "reactivate");
          else await adminApi.setDriverStatus(d.userId, pending.status, reason);
          setNotice("Saved — the driver was notified.");
          await load();
        }}
      />
    </div>
  );
}
