import { listTreasuryAccounts, getPendingReceivables } from "@/lib/holded/api";
import { createClient } from "@/lib/supabase/server";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(n);
}

function BalanceColor({ amount, children }: { amount: number; children: React.ReactNode }) {
  const color = amount > 0
    ? "text-green-600 dark:text-green-400"
    : amount < 0
      ? "text-red-600 dark:text-red-400"
      : "text-zinc-900 dark:text-white";
  return <span className={color}>{children}</span>;
}

export async function CashflowKpis() {
  const supabase = await createClient();

  const [accounts, receivables, { data: debts }] = await Promise.all([
    listTreasuryAccounts().catch(() => []),
    getPendingReceivables().catch(() => 0),
    supabase
      .from("debts")
      .select("total_amount, paid_amount")
      .eq("is_paid", false),
  ]);

  // BBVA only
  const bbva = accounts.find((a) => a.name === "BBVA");
  const totalBank = bbva?.balance ?? 0;

  // Total debt
  const totalDebt = (debts || []).reduce(
    (sum, d) => sum + (d.total_amount - d.paid_amount),
    0,
  );

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">Cashflow</h2>
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {/* BBVA */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">BBVA</p>
          <p className="mt-1 text-2xl font-bold">
            <BalanceColor amount={totalBank}>{formatEur(totalBank)}</BalanceColor>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">Saldo actual</p>
        </div>

        {/* Receivables */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nos deben</p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {formatEur(receivables)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">Facturas pendientes cobro</p>
        </div>

        {/* Debts */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Debemos</p>
          <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
            {formatEur(totalDebt)}
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">
            {(debts || []).length} deuda{(debts || []).length !== 1 ? "s" : ""}
          </p>
        </div>

        {/* Net position */}
        <div>
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Posicion neta</p>
          <p className="mt-1 text-2xl font-bold">
            <BalanceColor amount={totalBank + receivables - totalDebt}>
              {formatEur(totalBank + receivables - totalDebt)}
            </BalanceColor>
          </p>
          <p className="mt-1 text-[11px] text-zinc-400 dark:text-zinc-500">Banco + cobros - deudas</p>
        </div>
      </div>
    </div>
  );
}
