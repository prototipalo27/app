import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  type LeadStatus,
} from "@/lib/crm-config";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";

const SORTABLE_COLUMNS: Record<string, string> = {
  name: "full_name",
  company: "company",
  email: "email",
  status: "status",
  value: "estimated_value",
  date: "created_at",
};

function SortableHead({
  label,
  sortKey,
  currentSort,
  currentOrder,
  filterStatus,
  className,
}: {
  label: string;
  sortKey: string;
  currentSort: string | undefined;
  currentOrder: string | undefined;
  filterStatus: string | undefined;
  className?: string;
}) {
  const isActive = currentSort === sortKey;
  const nextOrder = isActive && currentOrder !== "asc" ? "asc" : "desc";
  const params = new URLSearchParams();
  if (filterStatus) params.set("status", filterStatus);
  params.set("sort", sortKey);
  params.set("order", nextOrder);

  return (
    <TableHead className={className}>
      <Link
        href={`/dashboard/crm/list?${params.toString()}`}
        className="inline-flex items-center gap-1 hover:text-foreground"
      >
        {label}
        {isActive ? (
          <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            {currentOrder === "asc" ? (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
            ) : (
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            )}
          </svg>
        ) : (
          <svg className="h-3.5 w-3.5 opacity-30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16V4m0 0L3 8m4-4l4 4m6 0v12m0 0l4-4m-4 4l-4-4" />
          </svg>
        )}
      </Link>
    </TableHead>
  );
}

export default async function CrmListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string; sort?: string; order?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const { status: filterStatus, sort: sortKey, order: sortOrder } = await searchParams;

  const supabase = await createClient();

  const dbColumn = sortKey && SORTABLE_COLUMNS[sortKey] ? SORTABLE_COLUMNS[sortKey] : "created_at";
  const ascending = sortOrder === "asc";

  let query = supabase
    .from("leads")
    .select("*")
    .order(dbColumn, { ascending });

  if (
    filterStatus &&
    LEAD_COLUMNS.some((c) => c.id === filterStatus)
  ) {
    query = query.eq("status", filterStatus);
  }

  const { data: leads } = await query;

  const assigneeIds = [
    ...new Set((leads || []).map((l) => l.assigned_to).filter(Boolean)),
  ] as string[];

  let assigneeMap = new Map<string, string>();
  if (assigneeIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", assigneeIds);
    assigneeMap = new Map(
      users?.map((u) => [u.id, u.email.split("@")[0]]) || []
    );
  }

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-foreground">
          Tracker — Lista de Leads
        </h1>
        <div className="flex gap-2">
          <Button variant="outline" render={<Link href="/dashboard/crm" />}>
            <svg className="mr-1.5 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 17V7m0 10a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h2a2 2 0 012 2m0 10a2 2 0 002 2h2a2 2 0 002-2M9 7a2 2 0 012-2h2a2 2 0 012 2m0 10V7" />
            </svg>
            Kanban
          </Button>
          <Button render={<Link href="/dashboard/crm/new" />} className="bg-brand text-white hover:bg-brand-dark">
            + Nuevo lead
          </Button>
        </div>
      </div>

      {/* Status filter tabs */}
      <div className="mb-4 flex flex-wrap gap-2">
        <Button
          variant={!filterStatus ? "default" : "ghost"}
          size="sm"
          render={<Link href="/dashboard/crm/list" />}
        >
          Todos
        </Button>
        {LEAD_COLUMNS.map((col) => (
          <Button
            key={col.id}
            variant={filterStatus === col.id ? "secondary" : "ghost"}
            size="sm"
            render={<Link href={`/dashboard/crm/list?status=${col.id}`} />}
            className={filterStatus === col.id ? col.badge : ""}
          >
            {col.label}
          </Button>
        ))}
      </div>

      {/* Table */}
      <div className="overflow-hidden rounded-xl border bg-card">
        <Table>
          <TableHeader>
            <TableRow>
              <SortableHead label="Nombre" sortKey="name" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} />
              <SortableHead label="Empresa" sortKey="company" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} />
              <SortableHead label="Email" sortKey="email" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} />
              <TableHead className="hidden md:table-cell">Telefono</TableHead>
              <SortableHead label="Estado" sortKey="status" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} />
              <SortableHead label="Valor est." sortKey="value" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} className="hidden text-right md:table-cell" />
              <TableHead className="hidden md:table-cell">Asignado</TableHead>
              <SortableHead label="Fecha" sortKey="date" currentSort={sortKey} currentOrder={sortOrder} filterStatus={filterStatus} />
            </TableRow>
          </TableHeader>
          <TableBody>
            {(!leads || leads.length === 0) ? (
              <TableRow>
                <TableCell
                  colSpan={8}
                  className="py-8 text-center text-muted-foreground"
                >
                  No hay leads
                  {filterStatus ? ` con estado "${STATUS_LABELS[filterStatus as LeadStatus] || filterStatus}"` : ""}.
                </TableCell>
              </TableRow>
            ) : (
              leads.map((lead) => {
                const col = LEAD_COLUMNS.find((c) => c.id === lead.status);
                return (
                  <TableRow key={lead.id}>
                    <TableCell>
                      <Link
                        href={`/dashboard/crm/${lead.id}`}
                        className="font-medium text-foreground hover:underline"
                      >
                        {lead.full_name}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.company || "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {lead.email || "—"}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {lead.phone || "—"}
                    </TableCell>
                    <TableCell>
                      {col && (
                        <Badge variant="secondary" className={col.badge}>
                          {col.label}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-right md:table-cell">
                      {lead.estimated_value != null ? (
                        <span className="font-medium text-green-600 dark:text-green-400">
                          {lead.estimated_value.toLocaleString("es-ES")} €
                        </span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </TableCell>
                    <TableCell className="hidden text-muted-foreground md:table-cell">
                      {lead.assigned_to
                        ? assigneeMap.get(lead.assigned_to) || "—"
                        : "—"}
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {new Date(lead.created_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                      })}
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
