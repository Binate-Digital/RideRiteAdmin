import { useCallback, useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { adminApi, errorMessage } from "@/lib/api";
import { dateTime, label, money, parseDollars, paymentMethodLabel } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, ErrorBanner, Field, inputCls, KeyValue, Notice, PageHeader, Section, Spinner } from "@/components/ui";
import { MiniTable } from "@/pages/UserDetailPage";

type LatLng = { lat: number; lng: number } | null;

/** Route preview: OpenStreetMap embed framing pickup + drop-off, plus a Google Maps directions link. */
function RouteMap({ from, to }: { from: LatLng; to: LatLng }) {
  if (!from) return <div className="text-sm text-muted">No coordinates recorded for this trip.</div>;
  const pts = [from, to].filter(Boolean) as { lat: number; lng: number }[];
  const lats = pts.map((p) => p.lat);
  const lngs = pts.map((p) => p.lng);
  const pad = 0.01;
  const bbox = [Math.min(...lngs) - pad, Math.min(...lats) - pad, Math.max(...lngs) + pad, Math.max(...lats) + pad].join(",");
  const src = `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${from.lat},${from.lng}`;
  const directions = `https://www.google.com/maps/dir/?api=1&origin=${from.lat},${from.lng}${to ? `&destination=${to.lat},${to.lng}` : ""}`;
  return (
    <div>
      <iframe title="Trip route" src={src} className="w-full h-64 rounded-lg border border-border" loading="lazy" />
      <a href={directions} target="_blank" rel="noreferrer" className={`${btn.link} mt-2 inline-flex items-center gap-1`}>
        Open route in Google Maps <ExternalLink className="h-3 w-3" />
      </a>
    </div>
  );
}

/** TRD 6.4 trip details: rider, driver, route, timeline, fare, payments / refunds, disputes, chat (disputes only). */
export function TripDetailPage() {
  const { id = "" } = useParams();
  const [data, setData] = useState<any>(null);
  const [chat, setChat] = useState<any[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refundOpen, setRefundOpen] = useState(false);
  const [amount, setAmount] = useState("");

  const load = useCallback(async () => {
    try {
      setData(await adminApi.trip(id));
    } catch (e) {
      setError(errorMessage(e, "Failed to load trip"));
    }
  }, [id]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const t = data.trip;
  const card = data.payments.find((p: any) => p.purpose === "ride" && ["succeeded", "partially_refunded"].includes(p.status));
  const refundable = card ? card.amountCents - (card.refundedCents || 0) : 0;

  return (
    <div className="space-y-4">
      <Link to="/trips" className="inline-flex items-center gap-1 text-xs font-bold text-muted hover:text-foreground">
        <ArrowLeft className="h-3.5 w-3.5" /> Trips
      </Link>
      <PageHeader
        title="TRIP"
        subtitle={`${t.id} · ${dateTime(t.createdAt)}`}
        actions={
          <>
            <Badge>{t.status}</Badge>
            {can("trips:refund") && refundable > 0 && (
              <button className={btn.danger} onClick={() => { setAmount(""); setRefundOpen(true); }}>Refund…</button>
            )}
          </>
        }
      />
      <ErrorBanner error={error} onClose={() => setError(null)} />
      <Notice message={notice} onClose={() => setNotice(null)} />

      <div className="grid lg:grid-cols-3 gap-4">
        <Section title="People">
          <KeyValue
            rows={[
              ["Rider", data.rider ? <Link key="r" className="text-primary" to={`/users/${data.rider.id}`}>{data.rider.fullName || data.rider.email}</Link> : "—"],
              ["Rider email", data.rider?.email || "—"],
              ["Driver", data.driver ? <Link key="d" className="text-primary" to={`/drivers/${data.driver.id}`}>{data.driver.fullName || data.driver.email}</Link> : "none assigned"],
              [
                "Vehicle",
                data.driver?.vehicle
                  ? `${[data.driver.vehicle.vehicleMake, data.driver.vehicle.vehicleModel].filter(Boolean).join(" ")} · ${data.driver.vehicle.vehiclePlate}`
                  : t.vehicleType?.toUpperCase(),
              ],
              ["Rating", t.riderRating ? `${t.riderRating}★ ${t.riderReview ? `“${t.riderReview}”` : ""}` : "—"],
            ]}
          />
        </Section>
        <Section title="Fare">
          <KeyValue
            rows={[
              ["Base", money(t.fare.baseRateCents)],
              ["Distance", `${money(t.fare.distanceCents)} (${t.distanceMiles} mi)`],
              ["Time", `${money(t.fare.timeCents)} (${t.durationMinutes} min)`],
              ["Booking fee", money(t.fare.bookingFeeCents)],
              ["Service fee", money(t.fare.serviceFeeCents)],
              ["Tax", money(t.fare.taxCents)],
              ["Discount", t.fare.discountCents ? `−${money(t.fare.discountCents)} ${t.promoCode || ""}` : "—"],
              ["Total", <span key="t" className="font-bold text-primary">{money(t.fare.totalCents)}</span>],
              ["Driver earns", money(t.driverEarningsCents)],
            ]}
          />
        </Section>
        <Section title="Payment">
          <KeyValue
            rows={[
              ["Method", paymentMethodLabel(t.paymentMethod)],
              ["Status", <Badge key="p">{t.paymentStatus}</Badge>],
              ["Paid", t.paid ? dateTime(t.paidAt) : "no"],
              ["Refunded", money(t.refundCents)],
              ["Cancel fee", money(t.cancelFeeCents)],
              ["Cancelled by", t.cancelledBy || "—"],
              ["Cancel reason", t.cancelReason || "—"],
            ]}
          />
        </Section>
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <Section title="Route">
          <div className="text-sm mb-2">
            <div><span className="text-muted">Pickup:</span> {t.pickupAddress}</div>
            <div><span className="text-muted">Drop-off:</span> {t.destinationAddress}</div>
          </div>
          <RouteMap from={t.pickupCoords} to={t.destinationCoords} />
        </Section>
        <Section title="Timeline">
          <ol className="space-y-2 text-sm">
            {data.timeline.map((s: any) => (
              <li key={s.label} className="flex justify-between border-b border-border pb-1.5">
                <span className="capitalize">{s.label}</span>
                <span className="text-muted">{dateTime(s.at)}</span>
              </li>
            ))}
          </ol>
          {t.quotedPickupEtaMinutes != null && <div className="mt-2 text-xs text-muted">Pickup ETA quoted at accept: {t.quotedPickupEtaMinutes} min</div>}
        </Section>
      </div>

      <Section title="Payments & refunds">
        <MiniTable
          rows={data.payments}
          cols={[
            ["When", (p: any) => dateTime(p.createdAt)],
            ["Amount", (p: any) => money(p.amountCents)],
            ["Status", (p: any) => <Badge>{p.status}</Badge>],
            ["Refunds", (p: any) => (p.refunds?.length ? p.refunds.map((r: any) => `${money(r.amountCents)} (${r.reason || "—"})`).join(", ") : "—")],
            ["Provider", (p: any) => p.provider],
          ]}
        />
      </Section>

      {data.disputes.length > 0 && (
        <Section title="Reported problems" actions={<Link to="/disputes" className={btn.link}>Dispute queue →</Link>}>
          <MiniTable
            rows={data.disputes}
            cols={[
              ["When", (d: any) => dateTime(d.createdAt)],
              ["Category", (d: any) => label(d.category)],
              ["Description", (d: any) => d.description],
              ["Status", (d: any) => <Badge>{d.status}</Badge>],
              ["Resolution", (d: any) => d.resolutionNotes || "—"],
            ]}
          />
        </Section>
      )}

      <Section
        title={`Chat transcript (${data.chat.messages} messages)`}
        actions={
          data.chat.available && !chat ? (
            <button
              className={btn.ghost}
              onClick={() =>
                void adminApi
                  .tripChat(t.id)
                  .then((r) => setChat(r.messages))
                  .catch((e) => setError(errorMessage(e)))
              }
            >
              Show transcript (audited)
            </button>
          ) : null
        }
      >
        {!data.chat.available && <div className="text-sm text-muted">Transcripts are only available for trips with a reported problem.</div>}
        {chat && (
          <div className="space-y-1.5 text-sm">
            {chat.length === 0 && <div className="text-muted">No messages.</div>}
            {chat.map((m) => (
              <div key={m.id}>
                <span className="text-xs text-muted">{dateTime(m.createdAt)}</span>{" "}
                <span className="font-semibold capitalize">{m.from}:</span> {m.body}
              </div>
            ))}
          </div>
        )}
      </Section>

      <ConfirmDialog
        open={refundOpen}
        title="Refund trip"
        danger
        confirmLabel="Refund"
        message={`Up to ${money(refundable)} can still be refunded to the rider's card. The rider is notified.`}
        reason={{ label: "Reason", minLength: 3 }}
        onClose={() => setRefundOpen(false)}
        onConfirm={async (reason) => {
          const cents = parseDollars(amount);
          if (!cents) throw new Error("Enter a refund amount");
          if (cents > refundable) throw new Error(`At most ${money(refundable)} can be refunded`);
          const res = await adminApi.refundTrip(t.id, cents, reason);
          setNotice(`Refunded ${money(res.refund.amountCents)}.`);
          await load();
        }}
      >
        <div className="mt-3">
          <Field label="Amount ($)">
            <input value={amount} onChange={(e) => setAmount(e.target.value)} placeholder={(refundable / 100).toFixed(2)} className={`w-full ${inputCls}`} />
          </Field>
        </div>
      </ConfirmDialog>
    </div>
  );
}
