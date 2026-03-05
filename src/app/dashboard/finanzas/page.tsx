import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { getFixedExpenses, getTaxPayments, getPendingInvoices, getFinancings, getCashFlowPipeline } from "./actions";
import { getNextTaxDeadline, getModelName } from "@/lib/finance/tax-calendar";
import FixedExpensesSection from "./fixed-expenses-section";
import FinancingsSection from "./financings-section";
import TaxCalendarSection from "./tax-calendar-section";
import CashFlowPipeline from "./cash-flow-pipeline";
import PaymentCalendarSection from "./payment-calendar-section";
import ReportDownloadButton from "./report-download-button";

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
    financings,
    cashFlowData,
    { data: projects },
    { data: purchaseItems },
    { data: shipments },
    { data: bankStatements },
    { data: vendorMappingsData },
  ] = await Promise.all([
    getFixedExpenses(),
    getTaxPayments(),
    getPendingInvoices(),
    getFinancings(),
    getCashFlowPipeline(),
    supabase
      .from("projects")
      .select("id, name, price, invoice_date, status, project_type"),
    supabase.from("purchase_items").select("id, status, actual_price, estimated_price, created_at"),
    supabase.from("shipping_info").select("id, price, created_at"),
    supabase.from("bank_statements").select("month, year, transactions").order("year").order("month"),
    supabase.from("vendor_mappings").select("bank_vendor_name, category"),
  ]);

  const allProjects = projects ?? [];
  const confirmedProjects = allProjects.filter((p) => p.project_type === "confirmed");
  const upcomingProjects = allProjects.filter((p) => p.project_type === "upcoming");
  const allPurchases = purchaseItems ?? [];
  const allShipments = shipments ?? [];
  const allBankStatements = bankStatements ?? [];

  // ── Vendor category map ──
  const vendorCategoryMap = new Map<string, string>();
  for (const vm of vendorMappingsData ?? []) {
    if (vm.category) {
      vendorCategoryMap.set(vm.bank_vendor_name.toLowerCase(), vm.category);
    }
  }

  // Helper: compute categorized expenses from a bank statement's transactions
  type BankTx = { vendorName?: string; amount: number };
  function getCategorizedExpenses(txs: BankTx[]) {
    const byCategory: Record<string, number> = {};
    let uncategorized = 0;
    for (const t of txs) {
      if (t.amount >= 0) continue; // skip income
      const cat = t.vendorName ? vendorCategoryMap.get(t.vendorName.toLowerCase()) : undefined;
      if (cat) {
        byCategory[cat] = (byCategory[cat] || 0) + Math.abs(t.amount);
      } else {
        uncategorized += Math.abs(t.amount);
      }
    }
    return { byCategory, uncategorized, total: Object.values(byCategory).reduce((s, v) => s + v, 0) + uncategorized };
  }

  // Build month key → categorized expenses map
  const bankExpensesByMonth = new Map<string, ReturnType<typeof getCategorizedExpenses>>();
  for (const stmt of allBankStatements) {
    const key = `${stmt.year}-${String(stmt.month).padStart(2, "0")}`;
    const txs = (stmt.transactions as unknown as BankTx[]) || [];
    bankExpensesByMonth.set(key, getCategorizedExpenses(txs));
  }

  // ── KPIs ──
  // Ofertado: upcoming projects (proformas) by invoice_date
  const offeredThisMonth = upcomingProjects
    .filter((p) => isThisMonth(p.invoice_date))
    .reduce((s, p) => s + (p.price ?? 0), 0);

  // Facturado: confirmed projects by invoice_date
  const invoicedThisMonth = confirmedProjects
    .filter((p) => isThisMonth(p.invoice_date))
    .reduce((s, p) => s + (p.price ?? 0), 0);

  // Producido (entregado): confirmed + delivered projects by invoice_date
  const deliveredThisMonth = confirmedProjects
    .filter((p) => p.status === "delivered" && isThisMonth(p.invoice_date))
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

  // Financing monthly payments (only active ones within their period)
  const monthlyFinancingPayments = financings.reduce((sum, f) => {
    if (f.paid_installments >= f.total_installments) return sum;
    return sum + f.monthly_payment;
  }, 0);

  const balanceThisMonth = invoicedThisMonth - monthlyFixedExpenses - variableExpensesThisMonth - monthlyFinancingPayments;

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

  const CATEGORY_LABELS: Record<string, string> = {
    payroll: "Nominas", rent: "Alquiler", utilities: "Suministros",
    insurance: "Seguros", software: "Software/SaaS", telecom: "Telecomunicaciones",
    taxes: "Impuestos", materials: "Material", travel: "Viajes", meals: "Comidas", fuel: "Gasolinas", shipping: "Envios",
    banking: "Bancos", financing: "Financiaciones", marketing: "Marketing",
    professional: "Serv. profesionales", income: "Ingresos", other: "Otros",
  };

  const monthlyData = months6.map(({ key, label }) => {
    const offered = upcomingProjects
      .filter((p) => p.invoice_date && getMonthKey(p.invoice_date) === key)
      .reduce((s, p) => s + (p.price ?? 0), 0);
    const invoiced = confirmedProjects
      .filter((p) => p.invoice_date && getMonthKey(p.invoice_date) === key)
      .reduce((s, p) => s + (p.price ?? 0), 0);
    const delivered = confirmedProjects
      .filter((p) => p.status === "delivered" && p.invoice_date && getMonthKey(p.invoice_date) === key)
      .reduce((s, p) => s + (p.price ?? 0), 0);
    const varExpenses =
      allPurchases
        .filter((p) => p.status === "received" && p.created_at && getMonthKey(p.created_at) === key)
        .reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0) +
      allShipments
        .filter((s) => s.created_at && getMonthKey(s.created_at) === key)
        .reduce((s, sh) => s + (sh.price ?? 0), 0);

    // Use real bank expenses if available for this month
    const bankData = bankExpensesByMonth.get(key);
    const realBankExpenses = bankData ? bankData.total : 0;
    const hasBankData = !!bankData;

    // If we have bank data, use real total; otherwise fallback to estimated
    const totalExpenses = hasBankData
      ? realBankExpenses
      : monthlyFixedExpenses + varExpenses + monthlyFinancingPayments;
    const balance = invoiced - totalExpenses;

    return {
      label, offered, invoiced, delivered,
      fixedExpenses: monthlyFixedExpenses, varExpenses, financingPayments: monthlyFinancingPayments,
      balance, hasBankData, realBankExpenses,
      bankCategories: bankData?.byCategory ?? {},
      bankUncategorized: bankData?.uncategorized ?? 0,
    };
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
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Finanzas</h1>
        <ReportDownloadButton />
      </div>

      {/* ── A. KPIs ── */}
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3">
        <KpiCard label="Ofertado mes" value={formatEur(offeredThisMonth)} sub="Proformas enviadas" accent="amber" />
        <KpiCard label="Facturado mes" value={formatEur(invoicedThisMonth)} sub="Facturas emitidas" />
        <KpiCard label="Producido mes" value={formatEur(deliveredThisMonth)} sub="Proyectos entregados" accent="green" />
      </div>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiCard label="Gastos fijos mes" value={formatEur(monthlyFixedExpenses)} />
        <KpiCard label="Gastos variables mes" value={formatEur(variableExpensesThisMonth)} />
        {monthlyFinancingPayments > 0 && (
          <KpiCard label="Financiaciones mes" value={formatEur(monthlyFinancingPayments)} />
        )}
        <KpiCard
          label="Balance neto"
          value={formatEur(balanceThisMonth)}
          sub="Facturado - gastos"
          accent={balanceThisMonth >= 0 ? "green" : "red"}
        />
      </div>

      {/* ── Cash Flow Pipeline ── */}
      <CashFlowPipeline stages={cashFlowData.stages} />

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
                <th className="px-3 py-2 text-right text-xs font-medium text-amber-500">Ofertado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Facturado</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-green-500">Producido</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">G. Fijos</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">G. Var.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Financ.</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-blue-500">Banco real</th>
                <th className="px-3 py-2 text-right text-xs font-medium text-zinc-500">Balance</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
              {monthlyData.map((m) => (
                <tr key={m.label}>
                  <td className="px-3 py-2 font-medium text-zinc-900 dark:text-white capitalize">{m.label}</td>
                  <td className="px-3 py-2 text-right text-amber-600 dark:text-amber-400">{formatEur(m.offered)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.invoiced)}</td>
                  <td className="px-3 py-2 text-right text-green-600 dark:text-green-400">{formatEur(m.delivered)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.fixedExpenses)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.varExpenses)}</td>
                  <td className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">{formatEur(m.financingPayments)}</td>
                  <td className="px-3 py-2 text-right text-blue-600 dark:text-blue-400">
                    {m.hasBankData ? formatEur(m.realBankExpenses) : <span className="text-zinc-400">—</span>}
                  </td>
                  <td className={`px-3 py-2 text-right font-medium ${m.balance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-500"}`}>
                    {formatEur(m.balance)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── B2. Desglose gastos banco por categoria ── */}
      {monthlyData.some((m) => m.hasBankData) && (
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Gastos banco por categoria (6 meses)</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-200 dark:border-zinc-800">
                  <th className="px-3 py-2 text-left text-xs font-medium text-zinc-500">Categoria</th>
                  {monthlyData.map((m) => (
                    <th key={m.label} className="px-3 py-2 text-right text-xs font-medium text-zinc-500 capitalize">{m.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {(() => {
                  // Collect all categories that appear
                  const allCats = new Set<string>();
                  for (const m of monthlyData) {
                    for (const cat of Object.keys(m.bankCategories)) allCats.add(cat);
                    if (m.bankUncategorized > 0) allCats.add("_uncategorized");
                  }
                  const catList = Array.from(allCats).sort();
                  return catList.map((cat) => (
                    <tr key={cat}>
                      <td className="px-3 py-2 text-zinc-900 dark:text-white">
                        {cat === "_uncategorized" ? (
                          <span className="text-amber-600 dark:text-amber-400">Sin categorizar</span>
                        ) : (
                          CATEGORY_LABELS[cat] || cat
                        )}
                      </td>
                      {monthlyData.map((m) => {
                        const val = cat === "_uncategorized"
                          ? m.bankUncategorized
                          : (m.bankCategories[cat] || 0);
                        return (
                          <td key={m.label} className="px-3 py-2 text-right text-zinc-700 dark:text-zinc-300">
                            {val > 0 ? formatEur(val) : <span className="text-zinc-300 dark:text-zinc-700">—</span>}
                          </td>
                        );
                      })}
                    </tr>
                  ));
                })()}
                <tr className="border-t-2 border-zinc-300 dark:border-zinc-700">
                  <td className="px-3 py-2 font-semibold text-zinc-900 dark:text-white">Total</td>
                  {monthlyData.map((m) => (
                    <td key={m.label} className="px-3 py-2 text-right font-semibold text-zinc-900 dark:text-white">
                      {m.hasBankData ? formatEur(m.realBankExpenses) : "—"}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Calendario de pagos ── */}
      <PaymentCalendarSection
        fixedExpenses={fixedExpenses}
        taxPayments={taxPayments}
        financings={financings}
      />

      {/* ── C. Gastos Fijos ── */}
      <FixedExpensesSection expenses={fixedExpenses} matchMap={Object.fromEntries(matchMap)} />

      {/* ── D. Financiaciones ── */}
      <FinancingsSection financings={financings} />

      {/* ── E. Calendario Fiscal ── */}
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
