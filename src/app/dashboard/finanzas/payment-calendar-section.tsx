"use client";

interface FixedExpense {
  id: string;
  name: string;
  category: string;
  amount: number;
  frequency: string;
  day_of_month: number | null;
}

interface TaxPayment {
  id: string;
  model: string;
  period: string;
  amount: number | null;
  status: string;
  due_date: string;
}

interface Financing {
  id: string;
  name: string;
  monthly_payment: number;
  paid_installments: number;
  total_installments: number;
  start_date: string;
  end_date: string;
}

interface PaymentEntry {
  day: number;
  name: string;
  amount: number;
  type: "payroll" | "tax" | "financing" | "fixed";
}

const TYPE_STYLES: Record<PaymentEntry["type"], { dot: string; text: string }> = {
  payroll: {
    dot: "bg-violet-500",
    text: "text-violet-700 dark:text-violet-400",
  },
  tax: {
    dot: "bg-red-500",
    text: "text-red-700 dark:text-red-400",
  },
  financing: {
    dot: "bg-amber-500",
    text: "text-amber-700 dark:text-amber-400",
  },
  fixed: {
    dot: "bg-zinc-400",
    text: "text-zinc-700 dark:text-zinc-300",
  },
};

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function getLastFriday(year: number, month: number): number {
  // month is 0-indexed
  const lastDay = new Date(year, month + 1, 0);
  const dayOfWeek = lastDay.getDay();
  // Friday = 5
  const diff = dayOfWeek >= 5 ? dayOfWeek - 5 : dayOfWeek + 2;
  return lastDay.getDate() - diff;
}

const PAYROLL_CATEGORIES = ["payroll", "insurance", "autonomos"];
const QUARTERLY_MONTHS = [1, 4, 7, 10]; // Jan, Apr, Jul, Oct (1-indexed)

function getPaymentsForMonth(
  year: number,
  month: number, // 1-indexed
  fixedExpenses: FixedExpense[],
  taxPayments: TaxPayment[],
  financings: Financing[],
): PaymentEntry[] {
  const entries: PaymentEntry[] = [];
  const lastFriday = getLastFriday(year, month - 1);

  for (const exp of fixedExpenses) {
    const isPayroll = PAYROLL_CATEGORIES.includes(exp.category);

    // Skip quarterly expenses in non-quarterly months
    if (exp.frequency === "quarterly" && !QUARTERLY_MONTHS.includes(month)) {
      continue;
    }
    // Skip annual expenses (only in their specific month if day_of_month set, or January)
    if (exp.frequency === "annual") {
      const expMonth = exp.day_of_month ? 1 : 1; // default to January
      if (month !== expMonth) continue;
    }

    const day = isPayroll ? lastFriday : (exp.day_of_month || 1);

    entries.push({
      day,
      name: exp.name,
      amount: exp.frequency === "quarterly" ? exp.amount : exp.amount,
      type: isPayroll ? "payroll" : "fixed",
    });
  }

  // Tax payments pending in this month
  const monthStr = `${year}-${String(month).padStart(2, "0")}`;
  for (const tp of taxPayments) {
    if (tp.status === "paid") continue;
    if (!tp.due_date.startsWith(monthStr)) continue;
    const day = parseInt(tp.due_date.split("-")[2], 10);
    entries.push({
      day,
      name: `Mod. ${tp.model} (${tp.period})`,
      amount: tp.amount ?? 0,
      type: "tax",
    });
  }

  // Active financings
  for (const fin of financings) {
    if (fin.paid_installments >= fin.total_installments) continue;
    const start = new Date(fin.start_date);
    const end = new Date(fin.end_date);
    const current = new Date(year, month - 1, 15);
    if (current < start || current > end) continue;

    entries.push({
      day: 5,
      name: fin.name,
      amount: fin.monthly_payment,
      type: "financing",
    });
  }

  return entries.sort((a, b) => a.day - b.day);
}

export default function PaymentCalendarSection({
  fixedExpenses,
  taxPayments,
  financings,
}: {
  fixedExpenses: FixedExpense[];
  taxPayments: TaxPayment[];
  financings: Financing[];
}) {
  const now = new Date();
  const months: { year: number; month: number; label: string }[] = [];

  for (let i = 0; i < 3; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() + i, 1);
    months.push({
      year: d.getFullYear(),
      month: d.getMonth() + 1,
      label: d.toLocaleDateString("es-ES", { month: "long", year: "numeric" }),
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
        Calendario de pagos (3 meses)
      </h2>

      <div className="mb-3 flex flex-wrap gap-3 text-[10px]">
        {(["payroll", "tax", "financing", "fixed"] as const).map((type) => (
          <span key={type} className="flex items-center gap-1">
            <span className={`inline-block h-2 w-2 rounded-full ${TYPE_STYLES[type].dot}`} />
            <span className="text-zinc-500 dark:text-zinc-400">
              {type === "payroll" ? "Nóminas/SS" : type === "tax" ? "Impuestos" : type === "financing" ? "Financiaciones" : "Gastos fijos"}
            </span>
          </span>
        ))}
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        {months.map(({ year, month, label }) => {
          const payments = getPaymentsForMonth(year, month, fixedExpenses, taxPayments, financings);
          const total = payments.reduce((s, p) => s + p.amount, 0);

          return (
            <div key={`${year}-${month}`} className="rounded-lg border border-zinc-100 p-3 dark:border-zinc-800">
              <p className="mb-2 text-xs font-semibold capitalize text-zinc-600 dark:text-zinc-400">
                {label}
              </p>
              <div className="space-y-1.5">
                {payments.length === 0 ? (
                  <p className="text-xs text-zinc-400">Sin pagos programados</p>
                ) : (
                  payments.map((p, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <span className={`inline-block h-1.5 w-1.5 rounded-full ${TYPE_STYLES[p.type].dot}`} />
                        <span className="text-[11px] text-zinc-700 dark:text-zinc-300">
                          <span className="text-zinc-400">{p.day}d</span> {p.name}
                        </span>
                      </div>
                      {p.amount > 0 && (
                        <span className={`text-[10px] font-medium ${TYPE_STYLES[p.type].text}`}>
                          {formatEur(p.amount)}
                        </span>
                      )}
                    </div>
                  ))
                )}
              </div>
              <div className="mt-2 border-t border-zinc-100 pt-2 dark:border-zinc-800">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-medium text-zinc-500">Total salidas</span>
                  <span className="text-xs font-bold text-zinc-900 dark:text-white">
                    {formatEur(total)}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
