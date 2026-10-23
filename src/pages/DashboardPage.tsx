import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Radio } from "lucide-react";
import { adminApi, errorMessage, type Analytics, type LiveCounters } from "@/lib/api";
import { adminSocket } from "@/lib/realtime";
import { money } from "@/lib/format";
import { can } from "@/lib/session";
import { ErrorBanner, PageHeader, Panel, Pills, Spinner, Stat } from "@/components/ui";
import { TrendChart } from "@/components/TrendChart";

/** TRD 6.2: users & drivers, live activity (Socket.IO), revenue & payables, memberships, trends. */
export function DashboardPage() {
  const [days, setDays] = useState<"7" | "30">("7");
  const [data, setData] = useState<Analytics | null>(null);
  const [live, setLive] = useState<LiveCounters | null>(null);
  const [connected, setConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    try {
      const res = await adminApi.analytics(Number(days));
      setData(res);
      setLive(res.live);
      setError(null);
    } catch (e) {
      setError(errorMessage(e, "Failed to load analytics"));
    }
  }, [days]);

  useEffect(() => {
    void load();
    // Totals refresh every minute; live counters arrive over the socket
    const t = window.setInterval(() => void load(), 60000);
    return () => window.clearInterval(t);
  }, [load]);

  useEffect(() => {
    const s = adminSocket();
    if (!s) return;
    const onCounters = (c: LiveCounters) => setLive(c);
    const onConnect = () => setConnected(true);
    const onDisconnect = () => setConnected(false);
    s.on("admin:counters", onCounters);
    s.on("connect", onConnect);
    s.on("disconnect", onDisconnect);
    setConnected(s.connected);
    return () => {
      s.off("admin:counters", onCounters);
      s.off("connect", onConnect);
      s.off("disconnect", onDisconnect);
    };
  }, []);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;

  const all = data.revenue.allTime;
  const period = data.revenue.period;
  const q = data.queues;
  const queueLinks: { label: string; n: number; to: string; perm: string }[] = [
    { label: "KYC applications", n: q.kyc, to: "/kyc", perm: "drivers:read" },
    { label: "Document / vehicle reviews", n: q.documentReviews, to: "/drivers?status=documents", perm: "drivers:read" },
    { label: "Open disputes", n: q.openDisputes, to: "/disputes", perm: "disputes:manage" },
    { label: "Listings to review", n: q.listingReviews, to: "/rentals", perm: "rentals:read" },
    { label: "Bonuses to review", n: q.bonusReviews, to: "/bonuses", perm: "bonuses:manage" },
    { label: "Maintenance requests", n: q.maintenanceRequests, to: "/maintenance", perm: "maintenance:manage" },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="DASHBOARD"
        subtitle="Platform activity, revenue and work queues"
        actions={<Pills value={days} options={[{ id: "7", label: "7 days" }, { id: "30", label: "30 days" }]} onChange={setDays} />}
      />
      <ErrorBanner error={error} />

      <div>
        <div className="mb-2 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-muted">
          <Radio className={`h-3.5 w-3.5 ${connected ? "text-success" : "text-muted"}`} />
          Live now {connected ? "" : "(reconnecting…)"}
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <Stat label="Active rides" value={live?.activeTrips ?? 0} sub={`${live?.searching ?? 0} searching for a driver`} />
          <Stat label="Active rentals" value={live?.activeRentals ?? 0} />
          <Stat label="Chauffeur bookings" value={live?.activeChauffeur ?? 0} sub="open or in progress" />
          <Stat label="Drivers online" value={live?.onlineDrivers ?? 0} />
          <Stat label="Trips this period" value={data.tripsInPeriod} sub={`last ${data.days} days`} />
        </div>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Riders" value={data.users.riders} sub={`${data.users.newInPeriod} new accounts in ${data.days} days`} />
        <Stat label="Drivers" value={data.users.drivers} sub={`${data.driverCounts.approved} approved · ${data.driverCounts.pending} awaiting review`} />
        <Stat label="Suspended accounts" value={data.users.suspended} tone={data.users.suspended ? "warning" : undefined} />
        <Stat label="Trips all time" value={data.totalTrips} sub={`${data.completed} completed · ${data.cancelled} cancelled`} />
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <Stat label="Platform revenue" value={money(period.platformRevenueCents)} sub={`last ${data.days} days · ${money(all.platformRevenueCents)} all time`} />
          <Stat label="Collected online" value={money(period.collectedCents)} sub={`${money(period.refundedCents)} refunded in period`} />
          <Stat
            label="Payable to drivers"
            value={money(data.payables.pendingCents)}
            sub={`${data.payables.pendingDrivers} drivers awaiting payout${data.payables.processingCents ? ` · ${money(data.payables.processingCents)} processing` : ""}`}
          />
          <Stat
            label="Memberships"
            value={data.subscriptions.active}
            sub={`MRR ${money(data.subscriptions.mrrCents)} · ${data.subscriptions.pastDue} past due · ${data.subscriptions.canceled} canceled`}
          />
      </div>

      <div className="grid lg:grid-cols-2 gap-4">
        <TrendChart title={`Trips per day (last ${data.days} days)`} points={data.trends.map((t) => ({ date: t.date, value: t.trips }))} />
        <TrendChart
          title={`Collected per day (last ${data.days} days)`}
          points={data.trends.map((t) => ({ date: t.date, value: t.collectedCents }))}
          format={money}
        />
      </div>

      <Panel className="p-4">
        <div className="font-bold mb-3">Work queues</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-2">
          {queueLinks
            .filter((l) => can(l.perm))
            .map((l) => (
              <Link
                key={l.label}
                to={l.to}
                className="flex items-center justify-between rounded-lg border border-border px-3 py-2.5 text-sm hover:bg-surface-2"
              >
                <span className="text-muted">{l.label}</span>
                <span className={`text-display text-xl ${l.n ? "text-warning" : "text-primary"}`}>{l.n}</span>
              </Link>
            ))}
        </div>
      </Panel>

      <Panel className="p-4">
        <div className="font-bold mb-3">Revenue by stream (last {data.days} days)</div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-6 gap-y-2 text-sm">
          {[
            ["Ride commission", period.rideCommissionCents],
            ["Ride service fees", period.rideServiceFeeCents],
            ["Promo discounts", -(period.rideDiscountCents || 0)],
            ["Rental commission", period.rentalCommissionCents],
            ["Fleet rentals", period.fleetRevenueCents],
            ["Chauffeur commission", period.chauffeurCommissionCents],
            ["Memberships", period.subscriptionRevenueCents],
            ["Late-cancel retained", period.bookingCancelRetainedCents],
          ].map(([k, v]) => (
            <div key={k as string} className="flex justify-between border-b border-border py-1.5">
              <span className="text-muted">{k}</span>
              <span className="font-semibold">{money(v as number)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  );
}
