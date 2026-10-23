import { useState } from "react";
import { Link } from "react-router-dom";
import { adminApi, type PlatformUser } from "@/lib/api";
import { usePagedList } from "@/hooks/usePagedList";
import { date, dateTime } from "@/lib/format";
import { can } from "@/lib/session";
import { Badge, DataTable, ErrorBanner, ExportButtons, FilterBar, PageHeader, Panel, Pills, SearchBox } from "@/components/ui";

const PAGE_SIZE = 20;

/** TRD 6.3: search riders & drivers by name, email or phone; open a profile. */
export function UsersPage() {
  const [q, setQ] = useState("");
  const [role, setRole] = useState<"all" | "rider" | "driver">("all");
  const [status, setStatus] = useState<"all" | "active" | "suspended" | "deactivated" | "inactive" | "deleted">("all");
  const filters = { q, role, status };
  const list = usePagedList<PlatformUser>(
    async (page) => {
      const res = await adminApi.users({ ...filters, page, limit: PAGE_SIZE });
      return { rows: res.users, total: res.total, totalPages: res.totalPages };
    },
    [q, role, status],
  );

  return (
    <div className="space-y-4">
      <PageHeader
        title="USERS"
        subtitle="Riders and drivers — open a profile to manage the account"
        actions={can("users:export") ? <ExportButtons onExport={(f) => adminApi.exportUsers(f, filters)} /> : null}
      />
      <Panel>
        <FilterBar>
          <SearchBox placeholder="Search name, email, phone or id…" onChange={setQ} />
          <Pills value={role} options={["all", "rider", "driver"] as const} onChange={setRole} />
          <Pills value={status} options={["all", "active", "suspended", "deactivated", "inactive", "deleted"] as const} onChange={setStatus} />
        </FilterBar>
        <div className="p-4 pb-0">
          <ErrorBanner error={list.error} />
        </div>
        <DataTable
          rows={list.rows}
          loading={list.loading}
          empty="No users match."
          paging={{ page: list.page, totalPages: list.totalPages, total: list.total, limit: PAGE_SIZE, onPageChange: list.setPage }}
          columns={[
            {
              key: "fullName",
              label: "User",
              render: (u) => (
                <Link to={`/users/${u.id}`} className="block">
                  <div className="font-semibold text-foreground hover:text-primary">{u.fullName || "—"}</div>
                  <div className="text-xs text-muted">{u.email || "no email"}</div>
                </Link>
              ),
            },
            { key: "phone", label: "Phone", render: (u) => u.phone || "—" },
            { key: "role", label: "Role", render: (u) => <Badge tone="info">{u.role}</Badge> },
            {
              key: "status",
              label: "Status",
              render: (u) => (
                <div>
                  <Badge>{u.status}</Badge>
                  {u.suspension?.reason && <div className="mt-1 text-xs text-muted max-w-[220px] truncate" title={u.suspension.reason}>{u.suspension.reason}</div>}
                </div>
              ),
            },
            { key: "createdAt", label: "Joined", render: (u) => date(u.createdAt) },
            { key: "lastLoginAt", label: "Last login", render: (u) => dateTime(u.lastLoginAt) },
          ]}
          actions={(u) => (
            <Link to={`/users/${u.id}`} className="text-xs font-bold text-primary">
              Open
            </Link>
          )}
        />
      </Panel>
    </div>
  );
}
