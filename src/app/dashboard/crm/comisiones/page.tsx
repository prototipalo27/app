import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import type { ProformaLineItem } from "../actions";

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

  // Fetch all won leads with an owner in the selected period
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

  // Fetch quote_requests for these leads to get totals
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

  // Fetch owner names
  const ownerIds = [...new Set((wonLeads || []).map((l) => l.owned_by).filter(Boolean))] as string[];
  let ownerMap = new Map<string, string>();
  if (ownerIds.length > 0) {
    const { data: owners } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", ownerIds);
    ownerMap = new Map(owners?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

  // For each won lead, determine if client is new or returning
  // (check if there are other won leads with the same email created before this one)
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

  // Group by owner
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

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/crm"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; Volver a CRM
          </Link>
          <h1 className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
            Comisiones
          </h1>
        </div>
      </div>

      {/* Period selector */}
      <div className="mb-6 flex flex-wrap items-center gap-3">
        <form className="flex items-center gap-2">
          <select
            name="month"
            defaultValue={selectedMonth}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          >
            {MONTHS.map((m, i) => (
              <option key={i + 1} value={i + 1}>{m}</option>
            ))}
          </select>
          <select
            name="year"
            defaultValue={selectedYear}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm dark:border-zinc-600 dark:bg-zinc-900 dark:text-white"
          >
            {[2024, 2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Filtrar
          </button>
        </form>
        <span className="text-sm text-zinc-500 dark:text-zinc-400">
          {MONTHS[selectedMonth - 1]} {selectedYear}
        </span>
      </div>

      {/* Summary per owner */}
      {byOwner.size === 0 ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No hay leads ganados con propietario comercial en este periodo.
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Summary table */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Resumen por comercial
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-6 py-3 font-medium">Comercial</th>
                    <th className="px-6 py-3 text-right font-medium">Leads ganados</th>
                    <th className="px-6 py-3 text-right font-medium">Total facturado</th>
                    <th className="px-6 py-3 text-right font-medium">Comision total</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byOwner.values()].map((owner) => (
                    <tr key={owner.name} className="border-b border-zinc-50 dark:border-zinc-800/50">
                      <td className="px-6 py-3 font-medium text-zinc-900 dark:text-white">{owner.name}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{owner.leads.length}</td>
                      <td className="px-6 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">{owner.total.toFixed(2)} €</td>
                      <td className="px-6 py-3 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">{owner.commission.toFixed(2)} €</td>
                    </tr>
                  ))}
                </tbody>
                <tfoot>
                  <tr className="border-t-2 border-zinc-200 dark:border-zinc-700">
                    <td className="px-6 py-3 font-semibold text-zinc-900 dark:text-white">Total</td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-white">
                      {leadCommissions.length}
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold text-zinc-900 dark:text-white">
                      {leadCommissions.reduce((s, l) => s + l.quoteTotal, 0).toFixed(2)} €
                    </td>
                    <td className="px-6 py-3 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                      {leadCommissions.reduce((s, l) => s + l.commission, 0).toFixed(2)} €
                    </td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </div>

          {/* Detail breakdown */}
          <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
            <div className="border-b border-zinc-100 px-6 py-4 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
                Desglose por lead
              </h2>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-zinc-100 text-xs text-zinc-500 dark:border-zinc-800 dark:text-zinc-400">
                    <th className="px-6 py-3 font-medium">Lead</th>
                    <th className="px-6 py-3 font-medium">Comercial</th>
                    <th className="px-6 py-3 font-medium">Tipo</th>
                    <th className="px-6 py-3 text-right font-medium">Total</th>
                    <th className="px-6 py-3 text-right font-medium">%</th>
                    <th className="px-6 py-3 text-right font-medium">Comision</th>
                  </tr>
                </thead>
                <tbody>
                  {leadCommissions.map((lc) => (
                    <tr key={lc.id} className="border-b border-zinc-50 dark:border-zinc-800/50">
                      <td className="px-6 py-3">
                        <Link
                          href={`/dashboard/crm/${lc.id}`}
                          className="font-medium text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {lc.fullName}
                        </Link>
                        {lc.company && (
                          <span className="ml-1.5 text-xs text-zinc-400">{lc.company}</span>
                        )}
                      </td>
                      <td className="px-6 py-3 text-zinc-600 dark:text-zinc-400">{lc.ownerName}</td>
                      <td className="px-6 py-3">
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            lc.isReturning
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {lc.isReturning ? "Recurrente" : "Nuevo"}
                        </span>
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-zinc-600 dark:text-zinc-400">
                        {lc.quoteTotal.toFixed(2)} €
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums text-zinc-500 dark:text-zinc-400">
                        {(lc.rate * 100).toFixed(1)}%
                      </td>
                      <td className="px-6 py-3 text-right tabular-nums font-semibold text-green-700 dark:text-green-400">
                        {lc.commission.toFixed(2)} €
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
