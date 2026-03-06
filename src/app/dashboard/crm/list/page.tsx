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

export default async function CrmListPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const { status: filterStatus } = await searchParams;

  const supabase = await createClient();

  let query = supabase
    .from("leads")
    .select("*")
    .order("created_at", { ascending: false });

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
          CRM — Lista de Leads
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
              <TableHead>Nombre</TableHead>
              <TableHead>Empresa</TableHead>
              <TableHead>Email</TableHead>
              <TableHead className="hidden md:table-cell">Telefono</TableHead>
              <TableHead>Estado</TableHead>
              <TableHead className="hidden text-right md:table-cell">Valor est.</TableHead>
              <TableHead className="hidden md:table-cell">Asignado</TableHead>
              <TableHead>Fecha</TableHead>
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
