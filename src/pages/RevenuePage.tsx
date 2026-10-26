import { useEffect, useState } from "react";
import { adminApi, errorMessage } from "@/lib/api";
import { money } from "@/lib/format";
import { ErrorBanner, inputCls, PageHeader, Panel, Spinner, Stat } from "@/components/ui";

/**
 * TRD 6.6 revenue by stream. Definitions match the dashboard (backend utils/revenue.js):
 * platform revenue = commissions + service fees − promo discounts + fleet rentals + memberships
 * + late-cancel amounts kept on rentals / chauffeur bookings.
 */
export function RevenuePage() {
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [data, setData] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    adminApi
      .revenue({ from, to })
      .then((d) => alive && (setData(d), setError(null)))
      .catch((e) => alive && setError(errorMessage(e)));
    return () => {
      alive = false;
    };
  }, [from, to]);

  if (!data) return error ? <ErrorBanner error={error} /> : <Spinner />;
  const streams: [string, number, string][] = [
    ["Ride commission", data.rideCommissionCents, "share of completed rides' base fare"],
    ["Ride service fees", data.rideServiceFeeCents, "rider service fee on completed rides"],
    ["Promo discounts", -data.rideDiscountCents, "platform-funded"],
    ["Rental commission", data.rentalCommissionCents, `${data.peerRentalCount} paid peer-to-peer rentals`],
    ["Fleet rental revenue", data.fleetRevenueCents, `${data.fleetRentalCount} paid company-fleet rentals`],
    ["Chauffeur commission", data.chauffeurCommissionCents, "completed private-driver bookings"],
    ["Membership revenue", data.subscriptionRevenueCents, "driver subscriptions, net of refunds"],
    ["Late-cancel retained", data.bookingCancelRetainedCents, "rentals / chauffeur cancelled late"],
    ["Ride cancellation fees", data.rideCancelFeePlatformCents ?? 0, "riders who cancelled after the driver was en route"],
  ];

  return (
    <div className="space-y-4">
      <PageHeader
        title="REVENUE"
        subtitle="Commissions, fees and memberships — same definitions as the dashboard"
        actions={
          <div className="flex items-center gap-2 text-xs text-muted">
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </div>
        }
      />
      <ErrorBanner error={error} />
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat label="Platform revenue" value={money(data.platformRevenueCents)} sub={from || to ? "selected period" : "all time"} />
        <Stat label="Collected online" value={money(data.collectedCents)} sub="rides, rentals, chauffeur, memberships" />
        <Stat label="Refunds issued" value={money(data.refundedCents)} />
        <Stat label="Payable to drivers" value={money(data.payablePendingCents)} sub={`${data.payablePendingDrivers} drivers · ${money(data.paidOutCents)} paid out in period`} />
      </div>
      <Panel className="p-4">
        <div className="font-bold mb-3">By stream</div>
        <div className="divide-y divide-border text-sm">
          {streams.map(([k, v, hint]) => (
            <div key={k} className="flex items-center justify-between py-2">
              <div>
                <div>{k}</div>
                <div className="text-xs text-muted">{hint}</div>
              </div>
              <div className="font-semibold">{money(v)}</div>
            </div>
          ))}
          <div className="flex items-center justify-between py-2 font-bold">
            <span>Platform revenue</span>
            <span className="text-primary">{money(data.platformRevenueCents)}</span>
          </div>
        </div>
      </Panel>
      <div className="grid sm:grid-cols-3 gap-4">
        <Stat label="Ride fares (gross)" value={money(data.rideFareCents)} sub={`${data.ridesCompleted} completed rides · ${money(data.rideTaxCents)} tax`} />
        <Stat
          label="Ride cancellation fees"
          value={money(data.rideCancelFeeCents)}
          sub={`collected from riders · ${money(data.rideCancelFeePlatformCents ?? 0)} platform revenue${data.rideCancelFeeDriverCents ? ` · ${money(data.rideCancelFeeDriverCents)} credited to drivers before the policy change` : ""}`}
        />
        <Stat label="Rental volume" value={money(data.rentalVolumeCents)} sub="peer + fleet, paid" />
      </div>
      {data.subscriptionOverview && (
        <Panel className="p-4">
          <div className="font-bold mb-2">Memberships</div>
          <div className="grid sm:grid-cols-5 gap-3 text-sm">
            <div>Active <span className="font-bold">{data.subscriptionOverview.active}</span></div>
            <div>Past due <span className="font-bold">{data.subscriptionOverview.pastDue}</span></div>
            <div>Canceled <span className="font-bold">{data.subscriptionOverview.canceled}</span></div>
            <div>Expired <span className="font-bold">{data.subscriptionOverview.expired}</span></div>
            <div>MRR <span className="font-bold text-primary">{money(data.subscriptionOverview.mrrCents)}</span></div>
          </div>
        </Panel>
      )}
    </div>
  );
}
