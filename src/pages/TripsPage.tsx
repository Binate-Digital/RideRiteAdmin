import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type PlatformTrip } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { dateTime, label, money, paymentMethodLabel } from "@/lib/format";
import { Badge, DataTable, ErrorBanner, FilterBar, inputCls, PageHeader, Panel, SearchBox } from "@/components/ui";

const PAGE_SIZE = 25;
const STATUSES = ["all", "active", "pending_payment", "requested", "accepted", "en_route", "arrived", "in_progress", "completed", "cancelled", "no_drivers", "disputed"];

/** TRD 6.4: monitor active and completed rides — server-side filters and pagination. */
export function TripsPage() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const list = usePagedList<PlatformTrip>(
    async (page) => {
      const res = await adminApi.trips({ q, status, from, to, page, limit: PAGE_SIZE });
      return { rows: res.trips, total: res.total, totalPages: res.totalPages };
    },
    [q, status, from, to],
  );

  return (
    <div className="space-y-4">
      <PageHeader title="TRIPS" subtitle="Every ride, filtered on the server" />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Rider / driver name, email, phone, address or trip id…" onChange={setQ} />
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {label(s)}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-xs text-muted">
            From <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className={inputCls} />
          </label>
          <label className="flex items-center gap-2 text-xs text-muted">
            To <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className={inputCls} />
          </label>
        </FilterBar>
        <div className="p-4 pb-0">
          <ErrorBanner error={list.error} />
        </div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          empty="No trips match."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            {
              key: "route",
              label: "Trip",
              render: (t) => (
                <Link to={`/trips/${t.id}`} className="block max-w-[340px]">
                  <div className="font-semibold truncate hover:text-primary">
                    {t.pickupAddress} → {t.destinationAddress}
                  </div>
                  <div className="text-xs text-muted">
                    {dateTime(t.createdAt)} · {t.vehicleType.toUpperCase()}
                  </div>
                </Link>
              ),
            },
            {
              key: "rider",
              label: "Rider",
              render: (t) => (t.rider ? <Link to={`/users/${t.rider.id}`} className="hover:text-primary">{t.rider.fullName || t.rider.email}</Link> : "—"),
            },
            {
              key: "driver",
              label: "Driver",
              render: (t) => (t.driver ? <Link to={`/drivers/${t.driver.id}`} className="hover:text-primary">{t.driver.fullName || t.driver.email}</Link> : <span className="text-muted">—</span>),
            },
            {
              key: "status",
              label: "Status",
              render: (t) => (
                <div className="space-x-1">
                  <Badge>{t.status}</Badge>
                  {t.disputed && <Badge tone="warn">disputed</Badge>}
                </div>
              ),
            },
            {
              key: "fare",
              label: "Fare",
              render: (t) => (
                <div>
                  <div className="font-bold text-primary">{money(t.fareCents)}</div>
                  <div className="text-xs text-muted">
                    {paymentMethodLabel(t.paymentMethod)} · {label(t.paymentStatus)}
                    {t.refundCents ? ` · refunded ${money(t.refundCents)}` : ""}
                  </div>
                </div>
              ),
            },
          ]}
        />
      </Panel>
    </div>
  );
}
