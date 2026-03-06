import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ProformaLineItem } from "../actions";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
  TableFooter,
} from "@/components/ui/table";

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const params = await searchParams;
  const now = new Date();
  const selectedYear = params.year ? parseInt(params.year) : now.getFullYear();
  const selectedMonth = params.month ? parseInt(params.month) : now.getMonth() + 1;

  const supabase = await createClient();

  const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
  const endDate = new Date(selectedYear, selectedMonth, 1).toISOString();

  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, full_name, company, email, owned_by, created_at, updated_at")
    .eq("status", "won")
    .not("owned_by", "is", null)
    .gte("updated_at", startDate)
    .lt("updated_at", endDate)
    .order("updated_at", { ascending: false });

  const leadIds = (wonLeads || []).map((l) => l.id);
  let quoteMap = new Map<string, number>();
  if (leadIds.length > 0) {
    const { data: quotes } = await supabase
      .from("quote_requests")
      .select("lead_id, items")
      .in("lead_id", leadIds);

    for (const q of quotes || []) {
      const items = (q.items || []) as unknown as ProformaLineItem[];
      const total = items.reduce((sum, i) => sum + i.price * i.units, 0);
      quoteMap.set(q.lead_id, total);
    }
  }

  const ownerIds = [...new Set((wonLeads || []).map((l) => l.owned_by).filter(Boolean))] as string[];
  let ownerMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", ownerIds);
    ownerMap = new Map(owners?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

  type LeadCommission = {
    id: string;
    fullName: string;
    company: string | null;
    ownerName: string;
    ownerId: string;
    quoteTotal: number;
    isReturning: boolean;
    rate: number;
    commission: number;
  };

  const leadCommissions: LeadCommission[] = [];

  for (const lead of wonLeads || []) {
    const quoteTotal = quoteMap.get(lead.id) ?? 0;
    if (quoteTotal === 0) continue;

    let isReturning = false;
    if (lead.email) {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .ilike("email", lead.email)
        .eq("status", "won")
        .neq("id", lead.id)
        .lt("created_at", lead.created_at);

      isReturning = (count ?? 0) > 0;
    }

    const rate = isReturning ? 0.075 : 0.15;
    leadCommissions.push({
      id: lead.id,
      fullName: lead.full_name,
      company: lead.company,
      ownerName: ownerMap.get(lead.owned_by!) || "—",
      ownerId: lead.owned_by!,
      quoteTotal,
      isReturning,
      rate,
      commission: quoteTotal * rate,
    });
  }

  const byOwner = new Map<string, { name: string; leads: LeadCommission[]; total: number; commission: number }>();
  for (const lc of leadCommissions) {
    if (!byOwner.has(lc.ownerId)) {
      byOwner.set(lc.ownerId, { name: lc.ownerName, leads: [], total: 0, commission: 0 });
    }
    const entry = byOwner.get(lc.ownerId)!;
    entry.leads.push(lc);
    entry.total += lc.quoteTotal;
    entry.commission += lc.commission;
  }

  const MONTHS = [
    "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
    "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
  ];

  const selectClass =
    "h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30";

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/crm"
            className="text-sm text-muted-foreground hover:text-foreground"
          >
            &larr; Volver a CRM
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-foreground">
            Comisiones
          </h1>
        </div>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          <select name="month" defaultValue={selectedMonth} className={selectClass}>
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select name="year" defaultValue={selectedYear} className={selectClass}>
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <Button type="submit" className="bg-brand text-white hover:bg-brand-dark">
            Filtrar
          </Button>
        </form>
        <span className="text-sm text-muted-foreground">
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </span>
      </div>

      {byOwner.size === 0 ? (
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-sm text-muted-foreground">
              No hay leads ganados con propietario comercial en este periodo.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          {/* Summary table */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Resumen por comercial</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Comercial</TableHead>
                    <TableHead className="text-right">Leads ganados</TableHead>
                    <TableHead className="text-right">Total facturado</TableHead>
                    <TableHead className="text-right">Comision total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...byOwner.values()].map((owner) => (
                    <TableRow key={owner.name}>
                      <TableCell className="font-medium">{owner.name}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.leads.length}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.total.toFixed(2)} €</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{owner.commission.toFixed(2)} €</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold">Total</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {leadCommissions.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {leadCommissions.reduce((s, l) => s + l.quoteTotal, 0).toFixed(2)} €
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                      {leadCommissions.reduce((s, l) => s + l.commission, 0).toFixed(2)} €
                    </TableCell>
                  </TableRow>
                </TableFooter>
              </Table>
            </CardContent>
          </Card>

          {/* Detail breakdown */}
          <Card>
            <CardHeader className="border-b">
              <CardTitle>Desglose por lead</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Lead</TableHead>
                    <TableHead>Comercial</TableHead>
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead className="text-right">%</TableHead>
                    <TableHead className="text-right">Comision</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {leadCommissions.map((lc) => (
                    <TableRow key={lc.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/crm/${lc.id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {lc.fullName}
                        </Link>
                        {lc.company && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{lc.company}</span>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground">{lc.ownerName}</TableCell>
                      <TableCell>
                        <Badge
                          variant="secondary"
                          className={
                            lc.isReturning
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }
                        >
                          {lc.isReturning ? "Recurrente" : "Nuevo"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {lc.quoteTotal.toFixed(2)} €
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {(lc.rate * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                        {lc.commission.toFixed(2)} €
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
