import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getFixedExpenses, getTaxPayments, getPendingInvoices } from "./actions";
import { getNextTaxDeadline, getModelName } from "@/lib/finance/tax-calendar";
import FixedExpensesSection from "./fixed-expenses-section";
import TaxCalendarSection from "./tax-calendar-section";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function isThisMonth(dateStr: string | null) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  const now = new Date();
  return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
}

function getMonthKey(dateStr: string) {
  const d = new Date(dateStr);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: "green" | "red" | "amber" }) {
  const colors = {
    green: "text-green-600 dark:text-green-400",
    red: "text-red-500",
    amber: "text-amber-600 dark:text-amber-400",
  };
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${accent ? colors[accent] : "text-zinc-900 dark:text-white"}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">{sub}</p>}
    </div>
  );
}

export default async function FinanzasPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const [
    fixedExpenses,
    taxPayments,
    pendingInvoices,
    { data: projects },
    { data: purchaseItems },
    { data: shipments },
    { data: bankStatements },
  ] = await Promise.all([
    getFixedExpenses(),
    getTaxPayments(),
    getPendingInvoices(),
    supabase
      .from("projects")
      .select("id, price, created_at, project_type")
      .eq("project_type", "confirmed"),
    supabase.from("purchase_items").select("id, status, actual_price, estimated_price, created_at"),
    supabase.from("shipping_info").select("id, price, created_at"),
    supabase.from("bank_statements").select("month, year, transactions").order("year").order("month"),
  ]);

  const allProjects = projects ?? [];
  const allPurchases = purchaseItems ?? [];
  const allShipments = shipments ?? [];
  const allBankStatements = bankStatements ?? [];

  // ── KPIs ──
  const revenueThisMonth = allProjects
    .filter((p) => isThisMonth(p.created_at))
    .reduce((s, p) => s + (p.price ?? 0), 0);

  // Fixed expenses prorated to monthly
  const monthlyFixedExpenses = fixedExpenses.reduce((sum, e) => {
    if (e.frequency === "monthly") return sum + e.amount;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    if (e.frequency === "annual") return sum + e.amount / 12;
    return sum + e.amount;
  }, 0);

  const variableExpensesThisMonth =
    allPurchases
      .filter((p) => p.status === "received" && isThisMonth(p.created_at))
      .reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0) +
    allShipments
      .filter((s) => isThisMonth(s.created_at))
      .reduce((s, sh) => s + (sh.price ?? 0), 0);

  const balanceThisMonth = revenueThisMonth - monthlyFixedExpenses - variableExpensesThisMonth;

  const pendingTotal = pendingInvoices.reduce((s, inv) => s + inv.total, 0);

  // ── 6-month evolution ──
  const now = new Date();
  const months6: { key: string; label: string }[] = [];
  for (let i = 5; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("es-ES", { month: "short", year: "2-digit" });
    months6.push({ key, label });
  }

  const monthlyData = months6.map(({ key, label }) => {
    const revenue = allProjects
      .filter((p) => p.created_at && getMonthKey(p.created_at) === key)
      .reduce((s, p) => s + (p.price ?? 0), 0);
    const varExpenses =
      allPurchases
        .filter((p) => p.status === "received" && p.created_at && getMonthKey(p.created_at) === key)
        .reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0) +
      allShipments
        .filter((s) => s.created_at && getMonthKey(s.created_at) === key)
        .reduce((s, sh) => s + (sh.price ?? 0), 0);
    const balance = revenue - monthlyFixedExpenses - varExpenses;

    return { label, revenue, fixedExpenses: monthlyFixedExpenses, varExpenses, balance };
  });

  // ── Bank statement matching for fixed expenses ──
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();
  const currentStatement = allBankStatements.find(
    (s) => s.month === currentMonth && s.year === currentYear
  );
  const bankTransactions = currentStatement
    ? (currentStatement.transactions as unknown as { vendorName: string; amount: number }[])
    : [];

  const expenseMatches = fixedExpenses.map((exp) => {
    if (!exp.bank_vendor_name) return { id: exp.id, matched: false };
    const found = bankTransactions.some(
      (t) => t.vendorName?.toLowerCase() === exp.bank_vendor_name!.toLowerCase()
    );
    return { id: exp.id, matched: found };
  });
  const matchMap = new Map(expenseMatches.map((m) => [m.id, m.matched]));

  // ── Next tax deadline ──
  const nextTax = getNextTaxDeadline(taxPayments);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Finanzas</h1>

      {/* ── A. KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Ingresos mes" value={formatEur(revenueThisMonth)} />
        <KpiCard label="Gastos fijos mes" value={formatEur(monthlyFixedExpenses)} />
        <KpiCard label="Gastos variables mes" value={formatEur(variableExpensesThisMonth)} />
        <KpiCard
          label="Balance neto"
          value={formatEur(balanceThisMonth)}
          accent={balanceThisMonth >= 0 ? "green" : "red"}
        />
      </div>

      {/* ── Cobros pendientes alert ── */}
      {pendingInvoices.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-800 dark:bg-amber-900/20">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Cobros pendientes: {formatEur(pendingTotal)}
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-500">
                {pendingInvoices.length} factura(s) sin cobrar en Holded
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── Next tax alert ── */}
      {nextTax && (
        <div
          className={`rounded-xl border p-4 ${
            nextTax.daysLeft <= 7
              ? "border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20"
              : nextTax.daysLeft <= 30
                ? "border-amber-200 bg-amber-50 dark:border-amber-800 dark:bg-amber-900/20"
                : "border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50"
          }`}
        >
          <p
            className={`text-sm font-semibold ${
              nextTax.daysLeft <= 7
                ? "text-red-700 dark:text-red-400"
                : nextTax.daysLeft <= 30
                  ? "text-amber-700 dark:text-amber-400"
                  : "text-zinc-700 dark:text-zinc-300"
            }`}
          >
            Proximo impuesto: {nextTax.name}
          </p>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Vence el {new Date(nextTax.dueDate).toLocaleDateString("es-ES")} ({nextTax.daysLeft} dias)
          </p>
        </div>
      )}

      {/* ── B. Evolucion 6 meses ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Evolucion 6 meses</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Mes</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Ingresos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">G. Fijos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">G. Variables</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {monthlyData.map((m) => (
                <tr key={m.label}>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white capitalize">{m.label}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.revenue)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.fixedExpenses)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.varExpenses)}</td>
                  <td className={`px-3 py-2 text-right font-medium ${m.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {formatEur(m.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── C. Gastos Fijos ── */}
      <FixedExpensesSection expenses={fixedExpenses} matchMap={Object.fromEntries(matchMap)} />

      {/* ── D. Calendario Fiscal ── */}
      <TaxCalendarSection taxPayments={taxPayments} />

      {/* ── E. Cobros Pendientes ── */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Cobros pendientes (Holded)</h2>
        {pendingInvoices.length === 0 ? (
          <p className="text-sm text-zinc-400">No hay facturas pendientes de cobro</p>
        ) : (
          <>
            <div className="mb-3 rounded-lg bg-amber-50 px-4 py-2 dark:bg-amber-900/20">
              <span className="text-lg font-bold text-amber-700 dark:text-amber-400">{formatEur(pendingTotal)}</span>
              <span className="ml-2 text-xs text-amber-600 dark:text-amber-500">pendiente de cobro</span>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-200 dark:border-zinc-800">
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Cliente</th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">N Factura</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Total</th>
                    <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Vencimiento</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                  {pendingInvoices.map((inv) => {
                    const dueDate = inv.dueDate ? new Date(inv.dueDate * 1000) : null;
                    const isOverdue = dueDate && dueDate < new Date();
                    return (
                      <tr key={inv.id}>
                        <td className="px-3 py-2 text-zinc-900 dark:text-white">{inv.contactName}</td>
                        <td className="px-3 py-2 text-zinc-500 dark:text-zinc-400">{inv.docNumber}</td>
                        <td className="px-3 py-2 text-right font-medium text-zinc-900 dark:text-white">{formatEur(inv.total)}</td>
                        <td className={`px-3 py-2 text-right ${isOverdue ? "text-red-500 font-medium" : "text-zinc-500 dark:text-zinc-400"}`}>
                          {dueDate ? dueDate.toLocaleDateString("es-ES") : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
