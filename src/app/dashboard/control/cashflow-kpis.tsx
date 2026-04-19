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

export async function CashflowKpis() {
  const supabase = await createClient();

  const [treasuryAccounts, receivables, { data: debts }] = await Promise.all([
    listTreasuryAccounts().catch(() => []),
    getPendingReceivables().catch(() => 0),
    supabase
      .from("debts")
      .select("total_amount, paid_amount")
      .eq("is_paid", false),
  ]);

  // Bank balance: sum all treasury accounts (or just BBVA if identifiable)
  const bankBalance = treasuryAccounts.reduce((sum, acc) => sum + acc.balance, 0);

  // Total debt: unpaid debts
  const totalDebt = (debts || []).reduce(
    (sum, d) => sum + (d.total_amount - d.paid_amount),
    0,
  );

  // Net position
  const netPosition = bankBalance + receivables - totalDebt;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Saldo banco</p>
        <p className={`mt-1 text-2xl font-bold ${bankBalance >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {formatEur(bankBalance)}
        </p>
        {treasuryAccounts.length > 0 && (
          <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
            {treasuryAccounts.map((a) => a.name).join(", ")}
          </p>
        )}
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Nos deben</p>
        <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
          {formatEur(receivables)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Facturas pendientes</p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Debemos</p>
        <p className="mt-1 text-2xl font-bold text-red-600 dark:text-red-400">
          {formatEur(totalDebt)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">
          {(debts || []).length} deuda{(debts || []).length !== 1 ? "s" : ""} pendiente{(debts || []).length !== 1 ? "s" : ""}
        </p>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Posicion neta</p>
        <p className={`mt-1 text-2xl font-bold ${netPosition >= 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400"}`}>
          {formatEur(netPosition)}
        </p>
        <p className="mt-0.5 text-xs text-zinc-400 dark:text-zinc-500">Banco + cobros - deudas</p>
      </div>
    </div>
  );
}
