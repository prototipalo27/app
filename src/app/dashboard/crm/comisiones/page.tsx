import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ProformaLineItem, CommissionTier } from "../actions";
import { getCommissionConfigs } from "../actions";
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
import { CommissionSettings } from "./commission-settings";

function getCurrentTierRate(tiers: CommissionTier[], totalBilling: number): number {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  if (totalBilling <= 0) return sorted[0]?.rate ?? 0;
  let rate = sorted[0]?.rate ?? 0;
  for (const tier of sorted) {
    if (totalBilling > tier.min) rate = tier.rate;
  }
  return rate;
}

function getBaseTierRate(tiers: CommissionTier[]): number {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  return sorted[0]?.rate ?? 0;
}

/**
 * Retroactive step-based: when you cross a tier, the new rate applies
 * to the ENTIRE month billing. Returns incremental commission for this lead.
 */
function calcTieredCommission(
  tiers: CommissionTier[],
  accumulatedBefore: number,
  quoteTotal: number
): { commission: number; effectiveRate: number } {
  const newTotal = accumulatedBefore + quoteTotal;
  const newRate = getCurrentTierRate(tiers, newTotal);
  const prevRate = getCurrentTierRate(tiers, accumulatedBefore);

  const newMonthTotal = newTotal * newRate;
  const prevMonthTotal = accumulatedBefore * prevRate;
  const commission = newMonthTotal - prevMonthTotal;

  return { commission, effectiveRate: newRate };
}

export default async function ComisionesPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string; year?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "comercial")) redirect("/dashboard");

  const isManager = hasRole(profile.role, "manager");

  const params = await searchParams;
  const now = new Date();
  const selectedYear = params.year ? parseInt(params.year) : now.getFullYear();
  const selectedMonth = params.month ? parseInt(params.month) : now.getMonth() + 1;

  const supabase = await createClient();

  const startDate = new Date(selectedYear, selectedMonth - 1, 1).toISOString();
  const endDate = new Date(selectedYear, selectedMonth, 1).toISOString();

  // Source of truth: paid quotes in the period (assigns each lead to its payment month)
  const { data: paidQuotes } = await supabase
    .from("quote_requests")
    .select("lead_id, items, paid_at")
    .eq("payment_status", "paid")
    .gte("paid_at", startDate)
    .lt("paid_at", endDate)
    .order("paid_at", { ascending: true });

  const quoteMap = new Map<string, number>();
  const leadPaidAt = new Map<string, string>();
  for (const q of paidQuotes || []) {
    if (!q.lead_id) continue;
    const items = (q.items || []) as unknown as ProformaLineItem[];
    const total = items.reduce((sum, i) => sum + i.price * i.units, 0);
    quoteMap.set(q.lead_id, (quoteMap.get(q.lead_id) ?? 0) + total);
    if (!leadPaidAt.has(q.lead_id)) leadPaidAt.set(q.lead_id, q.paid_at);
  }

  const leadIds = [...quoteMap.keys()];
  const { data: leadsData } = leadIds.length > 0
    ? await supabase
        .from("leads")
        .select("id, full_name, company, email, owned_by, assigned_to, created_at, payment_condition")
        .in("id", leadIds)
    : { data: [] as any[] };

  // Sort by paid_at to preserve correct tier accumulation order
  const wonLeads = [...(leadsData || [])].sort((a, b) => {
    const pa = leadPaidAt.get(a.id) || "";
    const pb = leadPaidAt.get(b.id) || "";
    return pa.localeCompare(pb);
  });

  // All user IDs involved (owners + closers)
  const allUserIds = [...new Set(
    (wonLeads || []).flatMap((l) => [l.owned_by, l.assigned_to]).filter(Boolean)
  )] as string[];
  let userMap = new Map<string, string>();
  if (allUserIds.length > 0) {
    const { data: users } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", allUserIds);
    userMap = new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

  // Load commission configs
  const commissionConfigs = await getCommissionConfigs();
  const configMap = new Map(commissionConfigs.map((c) => [c.user_id, c]));

  // Load all managers for settings dropdown
  const { data: allManagers } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("role", ["manager", "super_admin", "employee"])
    .eq("is_active", true);

  const managersForSettings = (allManagers || []).map((m) => ({
    id: m.id,
    name: m.email.split("@")[0],
  }));

  type CommercialSlot = {
    name: string;
    userId: string;
    rate: number;
    commission: number;
  };

  type LeadRow = {
    id: string;
    fullName: string;
    company: string | null;
    quoteTotal: number;
    paidAt: string | null;
    isReturning: boolean;
    captador: CommercialSlot | null;
    closer: CommercialSlot | null;
  };

  const leadRows: LeadRow[] = [];
  const leadRowById = new Map<string, LeadRow>();

  for (const lead of wonLeads) {
    const quoteTotal = quoteMap.get(lead.id) ?? 0;
    if (quoteTotal === 0) continue;
    const row: LeadRow = {
      id: lead.id,
      fullName: lead.full_name,
      company: lead.company,
      quoteTotal,
      paidAt: leadPaidAt.get(lead.id) ?? null,
      isReturning: false,
      captador: null,
      closer: null,
    };
    leadRows.push(row);
    leadRowById.set(lead.id, row);
  }

  // First pass: closer (tiered). Order matters: drives tier accumulation.
  const closerAccumulated = new Map<string, number>();
  const closerRatePerLead = new Map<string, number>();

  for (const lead of wonLeads) {
    const row = leadRowById.get(lead.id);
    if (!row || !lead.assigned_to) continue;

    const closerConfig = configMap.get(lead.assigned_to);
    if (!closerConfig || closerConfig.type !== "tiered") continue;

    const accBefore = closerAccumulated.get(lead.assigned_to) ?? 0;
    const result = calcTieredCommission(closerConfig.tiers, accBefore, row.quoteTotal);
    closerAccumulated.set(lead.assigned_to, accBefore + row.quoteTotal);
    closerRatePerLead.set(lead.id, result.effectiveRate);

    const isPrepaid = lead.payment_condition === "100-5";
    const bonusRate = isPrepaid ? closerConfig.prepaid_bonus : 0;
    const prepaidBonus = row.quoteTotal * bonusRate;

    if (!isManager && lead.assigned_to !== profile.id) continue;

    row.closer = {
      name: userMap.get(lead.assigned_to) || "—",
      userId: lead.assigned_to,
      rate: result.effectiveRate,
      commission: result.commission + prepaidBonus,
    };
  }

  // Second pass: captador (flat) with closer-excess deduction.
  for (const lead of wonLeads) {
    const row = leadRowById.get(lead.id);
    if (!row || !lead.owned_by) continue;

    const config = configMap.get(lead.owned_by);
    if (!config || config.type !== "flat") continue;

    let isReturning = false;
    if (lead.email) {
      const { count } = await supabase
        .from("leads")
        .select("id", { count: "exact", head: true })
        .ilike("email", lead.email)
        .eq("status", "paid")
        .neq("id", lead.id)
        .lt("created_at", lead.created_at);
      isReturning = (count ?? 0) > 0;
    }
    row.isReturning = isReturning;

    let rate = isReturning ? config.returning_rate : config.new_rate;

    if (lead.assigned_to) {
      const closerConfig = configMap.get(lead.assigned_to);
      if (closerConfig?.type === "tiered") {
        const baseRate = getBaseTierRate(closerConfig.tiers);
        const closerRate = closerRatePerLead.get(lead.id) ?? baseRate;
        const excess = closerRate - baseRate;
        rate = Math.max(0, rate - excess);
      }
    }

    const isPrepaid = lead.payment_condition === "100-5";
    const bonusRate = isPrepaid ? config.prepaid_bonus : 0;
    const prepaidBonus = row.quoteTotal * bonusRate;

    if (!isManager && lead.owned_by !== profile.id) continue;

    row.captador = {
      name: userMap.get(lead.owned_by) || "—",
      userId: lead.owned_by,
      rate,
      commission: row.quoteTotal * rate + prepaidBonus,
    };
  }

  // Drop rows with no commission visible to the current user
  const visibleRows = leadRows.filter((r) => r.captador || r.closer);

  type OwnerSummary = {
    name: string;
    leadsCount: number;
    total: number;
    commission: number;
    configType: "flat" | "tiered";
  };
  const byOwner = new Map<string, OwnerSummary>();

  for (const row of visibleRows) {
    if (row.closer) {
      const key = `${row.closer.userId}_closer`;
      const e = byOwner.get(key) ?? {
        name: `${row.closer.name} (closer)`,
        leadsCount: 0,
        total: 0,
        commission: 0,
        configType: "tiered" as const,
      };
      e.leadsCount += 1;
      e.total += row.quoteTotal;
      e.commission += row.closer.commission;
      byOwner.set(key, e);
    }
    if (row.captador) {
      const key = `${row.captador.userId}_captador`;
      const e = byOwner.get(key) ?? {
        name: `${row.captador.name} (captador)`,
        leadsCount: 0,
        total: 0,
        commission: 0,
        configType: "flat" as const,
      };
      e.leadsCount += 1;
      e.total += row.quoteTotal;
      e.commission += row.captador.commission;
      byOwner.set(key, e);
    }
  }

  const totalCommission = visibleRows.reduce(
    (s, r) => s + (r.captador?.commission ?? 0) + (r.closer?.commission ?? 0),
    0,
  );
  const totalBilled = visibleRows.reduce((s, r) => s + r.quoteTotal, 0);

  function formatPaidDate(iso: string | null): string {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("es-ES", { day: "numeric", month: "short" });
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
            &larr; Volver a Tracker
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
                    <TableHead>Tipo</TableHead>
                    <TableHead className="text-right">Leads ganados</TableHead>
                    <TableHead className="text-right">Total facturado</TableHead>
                    <TableHead className="text-right">Comision total</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[...byOwner.entries()].map(([ownerId, owner]) => (
                    <TableRow key={ownerId}>
                      <TableCell className="font-medium">{owner.name}</TableCell>
                      <TableCell>
                        <Badge variant="secondary" className={
                          owner.configType === "tiered"
                            ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                        }>
                          {owner.configType === "tiered" ? "Tramos" : "Plano"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.leadsCount}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.total.toFixed(2)} &euro;</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{owner.commission.toFixed(2)} &euro;</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={2}>Total</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {visibleRows.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {totalBilled.toFixed(2)} &euro;
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                      {totalCommission.toFixed(2)} &euro;
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
                    <TableHead>Pagado</TableHead>
                    <TableHead className="text-right">Total</TableHead>
                    <TableHead>Captador</TableHead>
                    <TableHead>Closer</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {visibleRows.map((row) => (
                    <TableRow key={row.id}>
                      <TableCell>
                        <Link
                          href={`/dashboard/crm/${row.id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {row.fullName}
                        </Link>
                        {row.company && (
                          <span className="ml-1.5 text-xs text-muted-foreground">{row.company}</span>
                        )}
                        {row.captador && (
                          <Badge
                            variant="secondary"
                            className={
                              "ml-1.5 " +
                              (row.isReturning
                                ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                                : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400")
                            }
                          >
                            {row.isReturning ? "Recurrente" : "Nuevo"}
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-muted-foreground tabular-nums">
                        {formatPaidDate(row.paidAt)}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {row.quoteTotal.toFixed(2)} &euro;
                      </TableCell>
                      <TableCell>
                        {row.captador ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{row.captador.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {(row.captador.rate * 100).toFixed(1)}% &middot;{" "}
                              <span className="font-semibold text-green-700 dark:text-green-400">
                                {row.captador.commission.toFixed(2)} &euro;
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                      <TableCell>
                        {row.closer ? (
                          <div className="flex flex-col">
                            <span className="text-sm">{row.closer.name}</span>
                            <span className="text-xs text-muted-foreground tabular-nums">
                              {(row.closer.rate * 100).toFixed(1)}% &middot;{" "}
                              <span className="font-semibold text-green-700 dark:text-green-400">
                                {row.closer.commission.toFixed(2)} &euro;
                              </span>
                            </span>
                          </div>
                        ) : (
                          <span className="text-xs text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Commission settings — only for managers */}
      {isManager && (
        <div className="mt-8">
          <CommissionSettings
            configs={commissionConfigs}
            users={managersForSettings}
          />
        </div>
      )}
    </div>
  );
}
