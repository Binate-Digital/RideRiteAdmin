import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { adminApi, errorMessage } from "@/lib/api";
import { date, dateTime, label, money, paymentMethodLabel } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, ErrorBanner, KeyValue, Notice, PageHeader, Section, Spinner } from "@/components/ui";
import { AuditTrail } from "@/components/AuditTrail";

type Action = "suspend" | "deactivate" | "reactivate" | "role" | "delete" | null;

/** TRD 6.3 detailed profile: account, activity, payments, bookings, prefs, status and audit. */
export function UserDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [action, setAction] = useState<Action>(null);

  const load = useCallback(async () => {
    try {
      setData(await adminApi.user(id));
    } catch (e) {
      setError(errorMessage(e, "Failed to load user"));
    }
  }, [id]);

  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const u = data.user;
  const deleted = u.status === "deleted";
  const nextRole = u.role === "driver" ? "rider" : "driver";

  return (
    <div className="space-y-4">
      <Link to="/users" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Users
      </Link>
      <PageHeader
        title={(u.fullName || "User").toUpperCase()}
        subtitle={`${u.email || "no email"} · ${u.phone || "no phone"} · ${u.id}`}
        actions={
          <>
            {can("users:manage") && !deleted && u.isActive && (
              <>
                <button className={btn.danger} onClick={() => setAction("suspend")}>Suspend</button>
                <button className={btn.danger} onClick={() => setAction("deactivate")}>Deactivate</button>
              </>
            )}
            {can("users:manage") && !deleted && !u.isActive && (
              <button className={btn.primary} onClick={() => setAction("reactivate")}>Reactivate</button>
            )}
            {can("users:manage") && !deleted && (
              <button className={btn.ghost} onClick={() => setAction("role")}>Make {nextRole}</button>
            )}
            {can("users:gdpr") && (
              <button
                className={btn.ghost}
                onClick={() => void adminApi.gdprExport(u.id).catch((e) => setError(errorMessage(e, "Export failed")))}
              >
                GDPR export
              </button>
            )}
            {can("users:gdpr") && !deleted && (
              <button className={btn.danger} onClick={() => setAction("delete")}>Delete (GDPR)</button>
            )}
          </>
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="Account">
          <KeyValue
            rows={[
              ["Status", <Badge key="s">{u.status}</Badge>],
              ["Reason", u.suspension?.reason || "—"],
              ["Since", u.suspension ? dateTime(u.suspension.at) : "—"],
              ["Role", <Badge key="r" tone="info">{u.role}</Badge>],
              ["Email verified", u.isEmailVerified ? "yes" : "no"],
              ["Phone verified", u.isPhoneVerified ? "yes" : "no"],
              ["Joined", date(u.createdAt)],
              ["Last login", dateTime(u.lastLoginAt)],
              ["Trips taken", data.stats.tripsTaken],
              ["Trips driven", data.stats.tripsDriven],
            ]}
          />
          {data.driver && (
            <Link to={`/drivers/${u.id}`} className={`${btn.link} mt-3 inline-block`}>
              Open driver profile →
            </Link>
          )}
        </Section>
        <Section title="Notification preferences">
          <KeyValue
            rows={[
              ...Object.entries(u.notificationPrefs || {}).map(([k, v]) => [label(k), v ? "on" : "off"] as [string, string]),
              ["Email channel", u.notificationChannels?.email === false ? "off" : "on"],
              ["Push channel", u.notificationChannels?.push === false ? "off" : "on"],
            ]}
          />
        </Section>
        <Section title="Driver money">
          {data.driver ? (
            <KeyValue
              rows={[
                ["Driver status", <Badge key="d">{data.driver.status}</Badge>],
                ["Membership", data.subscription ? `${data.subscription.plan} · ${data.subscription.status}` : "none"],
                ["Pending payout", money(data.earnings.pendingCents)],
                ["Processing", money(data.earnings.processingCents)],
                ["Paid out", money(data.earnings.paidCents)],
              ]}
            />
          ) : (
            <div className="text-sm text-muted">Not a driver.</div>
          )}
        </Section>
      </div>

      <Section title={`Trips as rider (${data.trips.length} latest)`}>
        <MiniTable
          rows={data.trips}
          cols={[
            ["When", (t) => <Link className="text-primary" to={`/trips/${t.id}`}>{dateTime(t.createdAt)}</Link>],
            ["Route", (t) => `${t.pickupAddress} → ${t.destinationAddress}`],
            ["Status", (t) => <Badge>{t.status}</Badge>],
            ["Fare", (t) => money(t.fare.totalCents)],
            ["Payment", (t) => `${paymentMethodLabel(t.paymentMethod)} · ${label(t.paymentStatus)}`],
          ]}
        />
      </Section>
      {data.tripsDriven.length > 0 && (
        <Section title="Trips as driver">
          <MiniTable
            rows={data.tripsDriven}
            cols={[
              ["When", (t) => <Link className="text-primary" to={`/trips/${t.id}`}>{dateTime(t.createdAt)}</Link>],
              ["Route", (t) => `${t.pickupAddress} → ${t.destinationAddress}`],
              ["Status", (t) => <Badge>{t.status}</Badge>],
              ["Earned", (t) => money(t.driverEarningsCents)],
            ]}
          />
        </Section>
      )}
      <Section title="Payments">
        <MiniTable
          rows={data.payments}
          cols={[
            ["When", (p) => dateTime(p.createdAt)],
            ["Purpose", (p) => p.purpose],
            ["Amount", (p) => money(p.amountCents)],
            ["Refunded", (p) => money(p.refundedCents)],
            ["Status", (p) => <Badge>{p.status}</Badge>],
          ]}
        />
      </Section>
      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Rental bookings">
          <MiniTable
            rows={data.rentals}
            cols={[
              ["Dates", (b) => `${date(b.startDate)} – ${date(b.endDate)}`],
              ["As", (b) => (b.renterId === u.id ? "renter" : "owner")],
              ["Total", (b) => money(b.totalCents)],
              ["Status", (b) => <Badge>{b.status}</Badge>],
            ]}
          />
        </Section>
        <Section title="Chauffeur bookings">
          <MiniTable
            rows={data.chauffeur}
            cols={[
              ["Start", (b) => dateTime(b.startAt)],
              ["Hours", (b) => b.durationHours],
              ["Total", (b) => money(b.totalCents)],
              ["Status", (b) => <Badge>{b.status}</Badge>],
            ]}
          />
        </Section>
      </div>
      {data.disputes.length > 0 && (
        <Section title="Reported problems">
          <MiniTable
            rows={data.disputes}
            cols={[
              ["When", (d) => dateTime(d.createdAt)],
              ["Category", (d) => label(d.category)],
              ["Status", (d) => <Badge>{d.status}</Badge>],
              ["Trip", (d) => <Link className="text-primary" to={`/trips/${d.tripId}`}>open</Link>],
            ]}
          />
        </Section>
      )}
      {can("audit:read") || data.audit.length ? (
        <Section title="Audit trail">
          <AuditTrail logs={data.audit} />
        </Section>
      ) : null}

      <ConfirmDialog
        open={action === "suspend" || action === "deactivate" || action === "reactivate"}
        title={action === "reactivate" ? "Reactivate account" : action === "suspend" ? "Suspend account" : "Deactivate account"}
        message={
          action === "reactivate"
            ? "The user can sign in again and is notified."
            : "The user is signed out everywhere, can't sign in, and is notified with this reason."
        }
        danger={action !== "reactivate"}
        confirmLabel={action === "reactivate" ? "Reactivate" : action === "suspend" ? "Suspend" : "Deactivate"}
        reason={action === "reactivate" ? undefined : { label: "Reason", minLength: 3, placeholder: "Shown to the user" }}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          await adminApi.setUserStatus(u.id, action as "suspend" | "deactivate" | "reactivate", reason);
          setNotice(`Account ${action === "reactivate" ? "reactivated" : action === "suspend" ? "suspended" : "deactivated"}.`);
          await load();
        }}
      />
      <ConfirmDialog
        open={action === "role"}
        title={`Make ${nextRole}`}
        message={
          nextRole === "driver"
            ? "They get a driver profile and must complete driver verification (KYC) before they can drive."
            : "They go offline and can no longer use the driver hub."
        }
        confirmLabel={`Make ${nextRole}`}
        onClose={() => setAction(null)}
        onConfirm={async () => {
          await adminApi.setUserRole(u.id, nextRole);
          setNotice(`Role changed to ${nextRole}.`);
          await load();
        }}
      />
      <ConfirmDialog
        open={action === "delete"}
        title="Delete account (GDPR)"
        danger
        confirmLabel="Delete personal data"
        message="Removes name, email, phone, documents, addresses and notifications. Trips and payments are kept for accounting under an anonymous id. This can't be undone — download a GDPR export first if the user asked for one."
        reason={{ label: "Request reference / reason", minLength: 3 }}
        onClose={() => setAction(null)}
        onConfirm={async (reason) => {
          await adminApi.gdprDelete(u.id, reason);
          setNotice("Personal data deleted.");
          await load();
        }}
      />
    </div>
  );
}

export function MiniTable({ rows, cols }: { rows: any[]; cols: [string, (row: any) => React.ReactNode][] }) {
  if (!rows?.length) return <div className="text-sm text-muted">None.</div>;
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="text-left text-[11px] uppercase tracking-wider text-muted border-b border-border">
          <tr>
            {cols.map(([h]) => (
              <th key={h} className="py-2 pr-4 font-bold whitespace-nowrap">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-border">
          {rows.map((r, i) => (
            <tr key={(r as any).id || i}>
              {cols.map(([h, render]) => (
                <td key={h} className="py-2 pr-4 align-top">{render(r)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
