import { useEffect, useState } from "react";
import { Loader2, Plus, Trash2 } from "lucide-react";
import { adminApi, errorMessage, uploadPhotos } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { date, label, money, parseDollars } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, btn, ConfirmDialog, DataTable, ErrorBanner, Field, FilterBar, inputCls, Modal, Notice, PageHeader, Panel, Pills, SearchBox } from "@/components/ui";

const PAGE_SIZE = 20;
type Tab = "review" | "listings" | "fleet" | "bookings";

/** TRD 6.5: listings oversight, review queue, company fleet management, rental transactions. */
export function RentalsPage() {
  const [tab, setTab] = useState<Tab>("review");
  const [notice, setNotice] = useState<string | null>(null);
  return (
    <div className="space-y-4">
      <PageHeader title="RENTALS" subtitle="Peer-to-peer and company fleet" />
      <Pills
        value={tab}
        options={[
          { id: "review", label: "review queue" },
          { id: "listings", label: "all listings" },
          { id: "fleet", label: "company fleet" },
          { id: "bookings", label: "bookings" },
        ]}
        onChange={setTab}
      />
      <Notice message={notice} onClose={() => setNotice(null)} />
      {tab === "bookings" ? <BookingsTab /> : <ListingsTab key={tab} tab={tab} onNotice={setNotice} />}
    </div>
  );
}

function ListingsTab({ tab, onNotice }: { tab: Exclude<Tab, "bookings">; onNotice: (m: string) => void }) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState<"all" | "peer" | "fleet">(tab === "fleet" ? "fleet" : "all");
  const [editing, setEditing] = useState<any | null>(null);
  const [confirm, setConfirm] = useState<{ row: any; status?: string; del?: boolean } | null>(null);
  const manage = can("rentals:manage");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.rentalListings({
        q,
        status: tab === "review" ? undefined : status,
        review: tab === "review" ? 1 : undefined,
        source: tab === "fleet" ? "fleet" : source,
        page,
        limit: PAGE_SIZE,
      });
      return { rows: res.listings, total: res.total, totalPages: res.totalPages };
    },
    [q, status, source],
  );

  return (
    <Panel>
      <FilterBar>
        <SearchBox placeholder="Title, make, model, plate, city, owner…" onChange={setQ} />
        {tab === "listings" && <Pills value={source} options={["all", "peer", "fleet"] as const} onChange={setSource} />}
        {tab !== "review" && (
          <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
            {["all", "pending", "active", "paused", "rejected", "draft"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        )}
        {tab === "fleet" && manage && (
          <button className={btn.primary} onClick={() => setEditing({})}>
            <Plus className="h-3.5 w-3.5" /> Add fleet vehicle
          </button>
        )}
      </FilterBar>
      <div className="p-4 pb-0">
        <ErrorBanner error={list.error} onClose={() => list.setError(null)} />
      </div>
      <DataTable
        rows={list.rows}
        loading={list.loading}
        empty={tab === "review" ? "Nothing waiting for review." : "No listings."}
        paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
        columns={[
          {
            key: "title",
            label: "Vehicle",
            render: (r) => (
              <div className="flex gap-3 items-start">
                {r.photos?.[0] ? (
                  <img src={r.photos[0]} alt="" className="h-12 w-16 rounded object-cover border border-border" loading="lazy" />
                ) : (
                  <div className="h-12 w-16 rounded border border-dashed border-border" />
                )}
                <div>
                  <div className="font-semibold">{r.title}</div>
                  <div className="text-xs text-muted">
                    {r.year} {r.make} {r.model} · {r.vehicleType.toUpperCase()} · {r.plate || "no plate"} · {r.city || "—"}
                  </div>
                </div>
              </div>
            ),
          },
          { key: "source", label: "Source", render: (r) => <Badge tone={r.source === "fleet" ? "info" : "muted"}>{r.source}</Badge> },
          { key: "owner", label: "Owner", render: (r) => (r.source === "fleet" ? "RideRite" : r.owner?.fullName || r.owner?.email || "—") },
          {
            key: "dailyRateCents",
            label: "Daily",
            render: (r) => (
              <div>
                <div>{money(r.dailyRateCents)}</div>
                {r.approvedDailyRateCents != null && r.approvedDailyRateCents !== r.dailyRateCents && (
                  <div className="text-xs text-warning">was {money(r.approvedDailyRateCents)}</div>
                )}
              </div>
            ),
          },
          {
            key: "status",
            label: "Status",
            render: (r) => (
              <div className="space-y-1">
                <Badge>{r.status}</Badge>
                {r.reviewReason && <div className="text-xs text-muted">{label(r.reviewReason)}</div>}
              </div>
            ),
          },
        ]}
        actions={
          manage
            ? (r) => (
                <div className="flex gap-2">
                  {r.status !== "active" && r.reviewReason !== "retired" && (
                    <button className={btn.primary} onClick={() => setConfirm({ row: r, status: "active" })}>Approve</button>
                  )}
                  {r.status === "active" && <button className={btn.ghost} onClick={() => setConfirm({ row: r, status: "paused" })}>Pause</button>}
                  {r.status === "pending" && r.source === "peer" && (
                    <button className={btn.danger} onClick={() => setConfirm({ row: r, status: "rejected" })}>Reject</button>
                  )}
                  {r.source === "fleet" && (
                    <>
                      <button className={btn.ghost} onClick={() => setEditing(r)}>Edit</button>
                      <button className={btn.danger} onClick={() => setConfirm({ row: r, del: true })} aria-label="Delete">
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </>
                  )}
                </div>
              )
            : undefined
        }
      />
      <ConfirmDialog
        open={Boolean(confirm)}
        title={confirm?.del ? "Delete fleet vehicle" : `${confirm?.status === "active" ? "Approve" : confirm?.status === "paused" ? "Pause" : "Reject"} listing`}
        message={
          confirm?.del
            ? "Vehicles with past bookings are retired (hidden) instead of deleted; upcoming bookings block this."
            : `${confirm?.row?.title}${confirm?.row?.source === "peer" ? " — the owner is notified." : ""}`
        }
        danger={confirm?.del || confirm?.status === "rejected"}
        reason={confirm?.status === "rejected" ? { label: "Note to the owner", minLength: 3 } : undefined}
        onClose={() => setConfirm(null)}
        onConfirm={async (note) => {
          if (!confirm) return;
          if (confirm.del) {
            const res = await adminApi.deleteFleet(confirm.row.id);
            onNotice(res.retired ? "Vehicle retired (it has booking history)." : "Vehicle deleted.");
          } else {
            await adminApi.updateRentalListing(confirm.row.id, { status: confirm.status, note });
            onNotice(`Listing ${confirm.status === "active" ? "approved" : confirm.status}.`);
          }
          await list.reload();
        }}
      />
      {editing && (
        <FleetForm
          listing={editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            onNotice(msg);
            void list.reload();
          }}
        />
      )}
    </Panel>
  );
}

const EMPTY = { title: "", vehicleType: "sedan", make: "", model: "", year: String(new Date().getFullYear()), plate: "", color: "", city: "", state: "FL", daily: "", description: "", status: "active" };

function FleetForm({ listing, onClose, onSaved }: { listing: any; onClose: () => void; onSaved: (msg: string) => void }) {
  const isNew = !listing.id;
  const [f, setF] = useState(() =>
    isNew
      ? EMPTY
      : {
          title: listing.title,
          vehicleType: listing.vehicleType,
          make: listing.make,
          model: listing.model,
          year: String(listing.year),
          plate: listing.plate || "",
          color: listing.color || "",
          city: listing.city || "",
          state: listing.state || "FL",
          daily: (listing.dailyRateCents / 100).toFixed(2),
          description: listing.description || "",
          status: listing.status === "paused" ? "paused" : "active",
        },
  );
  const [photos, setPhotos] = useState<string[]>(listing.photos || []);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof EMPTY) => (e: { target: { value: string } }) => setF((p) => ({ ...p, [k]: e.target.value }));
  useEffect(() => setError(null), [f]);

  const onFiles = async (files: FileList | null) => {
    if (!files?.length) return;
    setUploading(true);
    try {
      const urls = await uploadPhotos(Array.from(files).slice(0, 8 - photos.length));
      setPhotos((p) => [...p, ...urls].slice(0, 8));
    } catch (e) {
      setError(errorMessage(e, "Upload failed"));
    } finally {
      setUploading(false);
    }
  };

  const save = async () => {
    const daily = parseDollars(f.daily);
    if (!f.title.trim() || !f.make.trim() || !f.model.trim()) return setError("Title, make and model are required");
    if (!daily || daily < 1000) return setError("Daily rate must be at least $10");
    const body = {
      title: f.title.trim(),
      vehicleType: f.vehicleType,
      make: f.make.trim(),
      model: f.model.trim(),
      year: Number(f.year),
      plate: f.plate.trim(),
      color: f.color.trim(),
      city: f.city.trim(),
      state: f.state.trim() || "FL",
      dailyRateCents: daily,
      description: f.description.trim(),
      photos,
      status: f.status,
    };
    setBusy(true);
    try {
      if (isNew) await adminApi.createFleet(body);
      else await adminApi.updateFleet(listing.id, body);
      onSaved(isNew ? "Fleet vehicle added." : "Fleet vehicle updated.");
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal open title={isNew ? "Add fleet vehicle" : "Edit fleet vehicle"} onClose={onClose} wide>
      <div className="grid sm:grid-cols-2 gap-3">
        <div className="sm:col-span-2">
          <Field label="Title"><input value={f.title} onChange={set("title")} className={`w-full ${inputCls}`} placeholder="Tesla Model 3 Long Range" /></Field>
        </div>
        <Field label="Type">
          <select value={f.vehicleType} onChange={set("vehicleType")} className={`w-full ${inputCls}`}>
            <option value="sedan">Sedan</option>
            <option value="suv">SUV</option>
            <option value="truck">Truck</option>
          </select>
        </Field>
        <Field label="Daily rate ($)"><input value={f.daily} onChange={set("daily")} className={`w-full ${inputCls}`} placeholder="89.00" /></Field>
        <Field label="Make"><input value={f.make} onChange={set("make")} className={`w-full ${inputCls}`} /></Field>
        <Field label="Model"><input value={f.model} onChange={set("model")} className={`w-full ${inputCls}`} /></Field>
        <Field label="Year"><input value={f.year} onChange={set("year")} className={`w-full ${inputCls}`} inputMode="numeric" /></Field>
        <Field label="Plate"><input value={f.plate} onChange={set("plate")} className={`w-full ${inputCls}`} /></Field>
        <Field label="Color"><input value={f.color} onChange={set("color")} className={`w-full ${inputCls}`} /></Field>
        <Field label="City"><input value={f.city} onChange={set("city")} className={`w-full ${inputCls}`} /></Field>
        <Field label="State"><input value={f.state} onChange={set("state")} maxLength={2} className={`w-full ${inputCls}`} /></Field>
        <Field label="Status">
          <select value={f.status} onChange={set("status")} className={`w-full ${inputCls}`}>
            <option value="active">Active (bookable)</option>
            <option value="paused">Paused</option>
          </select>
        </Field>
        <div className="sm:col-span-2">
          <Field label="Description"><textarea value={f.description} onChange={set("description")} rows={3} className={`w-full ${inputCls}`} /></Field>
        </div>
        <div className="sm:col-span-2">
          <Field label={`Photos (${photos.length}/8)`}>
            <div className="flex flex-wrap gap-2">
              {photos.map((url) => (
                <div key={url} className="relative">
                  <img src={url} alt="" className="h-16 w-24 rounded border border-border object-cover" />
                  <button type="button" className="absolute -top-2 -right-2 rounded-full bg-danger px-1.5 text-xs text-white" onClick={() => setPhotos((p) => p.filter((u) => u !== url))} aria-label="Remove photo">
                    ×
                  </button>
                </div>
              ))}
              {photos.length < 8 && (
                <label className="h-16 w-24 grid place-items-center rounded border border-dashed border-border text-xs text-muted cursor-pointer hover:text-foreground">
                  {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : "+ Upload"}
                  <input type="file" accept="image/*" multiple className="hidden" onChange={(e) => void onFiles(e.target.files)} />
                </label>
              )}
            </div>
          </Field>
        </div>
      </div>
      {error && <div className="mt-3 text-sm text-danger">{error}</div>}
      <div className="mt-4 flex justify-end gap-2">
        <button className={btn.ghost} onClick={onClose}>Cancel</button>
        <button className={btn.primary} disabled={busy || uploading} onClick={() => void save()}>
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Save
        </button>
      </div>
    </Modal>
  );
}

function BookingsTab() {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("all");
  const [source, setSource] = useState<"all" | "peer" | "fleet">("all");
  const list = usePagedList<any>(
    async (page) => {
      const res = await adminApi.rentalBookings({ q, status, source, page, limit: PAGE_SIZE });
      return { rows: res.bookings, total: res.total, totalPages: res.totalPages, extra: res.totals };
    },
    [q, status, source],
  );
  const t = list.extra || {};
  return (
    <Panel>
      <FilterBar>
        <SearchBox placeholder="Renter or owner name / email…" onChange={setQ} />
        <Pills value={source} options={["all", "peer", "fleet"] as const} onChange={setSource} />
        <select value={status} onChange={(e) => setStatus(e.target.value)} className={inputCls}>
          {["all", "pending_payment", "confirmed", "active", "completed", "cancelled", "expired"].map((s) => (
            <option key={s} value={s}>{label(s)}</option>
          ))}
        </select>
      </FilterBar>
      <div className="px-4 pt-3 text-xs text-muted">
        Paid, matching filters — peer: {money(t.peer?.totalCents)} volume, {money(t.peer?.commissionCents)} commission · fleet: {money(t.fleet?.totalCents)} revenue
      </div>
      <div className="p-4 pb-0">
        <ErrorBanner error={list.error} />
      </div>
      <DataTable
        rows={list.rows}
        loading={list.loading}
        empty="No bookings."
        paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
        columns={[
          { key: "listingTitle", label: "Vehicle", render: (b) => b.listingTitle || "—" },
          { key: "renter", label: "Renter", render: (b) => b.renter?.fullName || b.renter?.email || "—" },
          { key: "source", label: "Source", render: (b) => <Badge tone={b.source === "fleet" ? "info" : "muted"}>{b.source}</Badge> },
          { key: "dates", label: "Dates", render: (b) => `${date(b.startDate)} – ${date(b.endDate)} (${b.days}d)` },
          { key: "totalCents", label: "Total", render: (b) => money(b.totalCents) },
          { key: "platformCents", label: "Platform", render: (b) => money(b.platformCents) },
          {
            key: "status",
            label: "Status",
            render: (b) => (
              <div className="space-y-1">
                <Badge>{b.status}</Badge>
                <div className="text-xs text-muted">{label(b.paymentStatus)}{b.refundCents ? ` · refunded ${money(b.refundCents)}` : ""}</div>
              </div>
            ),
          },
        ]}
      />
    </Panel>
  );
}
