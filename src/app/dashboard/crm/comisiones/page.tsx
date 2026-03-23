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

function calcTieredCommission(
  tiers: CommissionTier[],
  accumulatedBefore: number,
  quoteTotal: number
): { commission: number; effectiveRate: number } {
  const sorted = [...tiers].sort((a, b) => a.min - b.min);
  const newTotal = accumulatedBefore + quoteTotal;

  let rate = sorted[0]?.rate ?? 0;
  for (const tier of sorted) {
    const tierMax = tier.max ?? Infinity;
    if (newTotal > tier.min && newTotal <= tierMax) {
      rate = tier.rate;
      break;
    }
    if (newTotal > tierMax) {
      rate = tier.rate;
    }
  }
  if (newTotal > (sorted[sorted.length - 1]?.max ?? Infinity)) {
    rate = sorted[sorted.length - 1]?.rate ?? 0;
  }

  const commission = quoteTotal * rate;
  return { commission, effectiveRate: rate };
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

  // Get ALL won leads in period (both owned_by and assigned_to matter)
  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, full_name, company, email, owned_by, assigned_to, created_at, updated_at, payment_condition")
    .eq("status", "won")
    .gte("updated_at", startDate)
    .lt("updated_at", endDate)
    .order("updated_at", { ascending: true });

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
    configType: "flat" | "tiered";
    prepaidBonus: number;
    role: "captador" | "closer";
  };

  const leadCommissions: LeadCommission[] = [];

  // Track accumulated billing per closer for tiered calculation
  const closerAccumulated = new Map<string, number>();

  // Helper: get base tier rate (minimum) from a tiered config
  function getBaseTierRate(tiers: CommissionTier[]): number {
    const sorted = [...tiers].sort((a, b) => a.min - b.min);
    return sorted[0]?.rate ?? 0;
  }

  // First pass: calculate closer (tiered) commissions to know their rates
  // We need this to deduct from captador rates
  const closerRatePerLead = new Map<string, number>(); // leadId → closer effective rate

  for (const lead of wonLeads || []) {
    const quoteTotal = quoteMap.get(lead.id) ?? 0;
    if (quoteTotal === 0 || !lead.assigned_to) continue;

    const closerConfig = configMap.get(lead.assigned_to);
    if (!closerConfig || closerConfig.type !== "tiered") continue;

    const accBefore = closerAccumulated.get(lead.assigned_to) ?? 0;
    const result = calcTieredCommission(closerConfig.tiers, accBefore, quoteTotal);
    closerAccumulated.set(lead.assigned_to, accBefore + quoteTotal);

    closerRatePerLead.set(lead.id, result.effectiveRate);

    const isPrepaid = lead.payment_condition === "100-5";
    const bonusRate = isPrepaid ? closerConfig.prepaid_bonus : 0;
    const prepaidBonus = quoteTotal * bonusRate;

    // Non-manager comerciales only see their own
    if (!isManager && lead.assigned_to !== profile.id) continue;

    leadCommissions.push({
      id: lead.id,
      fullName: lead.full_name,
      company: lead.company,
      ownerName: userMap.get(lead.assigned_to) || "—",
      ownerId: lead.assigned_to,
      quoteTotal,
      isReturning: false,
      rate: result.effectiveRate,
      commission: result.commission + prepaidBonus,
      configType: "tiered",
      prepaidBonus,
      role: "closer",
    });
  }

  // Second pass: captador (flat) commissions, deducting closer excess
  for (const lead of wonLeads || []) {
    const quoteTotal = quoteMap.get(lead.id) ?? 0;
    if (quoteTotal === 0 || !lead.owned_by) continue;

    const config = configMap.get(lead.owned_by);
    if (!config || config.type !== "flat") continue;

    // Non-manager comerciales only see their own
    if (!isManager && lead.owned_by !== profile.id) continue;

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

    let rate = isReturning ? config.returning_rate : config.new_rate;

    // Deduct closer's excess above base tier
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
    const prepaidBonus = quoteTotal * bonusRate;

    leadCommissions.push({
      id: lead.id,
      fullName: lead.full_name,
      company: lead.company,
      ownerName: userMap.get(lead.owned_by) || "—",
      ownerId: lead.owned_by,
      quoteTotal,
      isReturning,
      rate,
      commission: quoteTotal * rate + prepaidBonus,
      configType: "flat",
      prepaidBonus,
      role: "captador",
    });
  }

  const byOwner = new Map<string, { name: string; leads: LeadCommission[]; total: number; commission: number; configType: "flat" | "tiered"; role: string }>();
  for (const lc of leadCommissions) {
    const key = `${lc.ownerId}_${lc.role}`;
    if (!byOwner.has(key)) {
      byOwner.set(key, { name: `${lc.ownerName} (${lc.role === "closer" ? "closer" : "captador"})`, leads: [], total: 0, commission: 0, configType: lc.configType, role: lc.role });
    }
    const entry = byOwner.get(key)!;
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
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.leads.length}</TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">{owner.total.toFixed(2)} &euro;</TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{owner.commission.toFixed(2)} &euro;</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
                <TableFooter>
                  <TableRow>
                    <TableCell className="font-semibold" colSpan={2}>Total</TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {leadCommissions.length}
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold">
                      {leadCommissions.reduce((s, l) => s + l.quoteTotal, 0).toFixed(2)} &euro;
                    </TableCell>
                    <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                      {leadCommissions.reduce((s, l) => s + l.commission, 0).toFixed(2)} &euro;
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
                        {lc.configType === "tiered" ? (
                          <Badge variant="secondary" className="bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400">
                            Tramos
                          </Badge>
                        ) : (
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
                        )}
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {lc.quoteTotal.toFixed(2)} &euro;
                      </TableCell>
                      <TableCell className="text-right tabular-nums text-muted-foreground">
                        {(lc.rate * 100).toFixed(1)}%
                      </TableCell>
                      <TableCell className="text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                        {lc.commission.toFixed(2)} &euro;
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
