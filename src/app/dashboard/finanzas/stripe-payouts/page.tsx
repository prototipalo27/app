import Link from "next/link";
import { getPayoutsWithCharges } from "./actions";
import PayoutsList from "./payouts-list";

function formatEur(n: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

export default async function StripePayoutsPage() {
  const payouts = await getPayoutsWithCharges(60);

  const now = new Date();
  const thisMonthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const thisMonth = payouts.filter((p) => {
    const d = new Date(p.arrivalDate * 1000);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}` === thisMonthKey;
  });
  const monthNet = thisMonth.reduce((s, p) => s + p.amount, 0);
  const monthFees = thisMonth.reduce((s, p) => s + p.totalFees, 0);
  const pendingCount = payouts.filter((p) => !p.reconciled && p.status === "paid").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            Payouts Stripe
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Cada fila es una linea de ingreso en BBVA. Cuadra el importe neto con el extracto y marca como conciliado.
          </p>
        </div>
        <Link
          href="/dashboard/finanzas/extracto"
          className="shrink-0 rounded-lg border border-zinc-200 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          Extracto BBVA
        </Link>
      </div>

      <div className="mb-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Recibido este mes (neto)
          </p>
          <p className="mt-1 text-2xl font-bold text-green-600 dark:text-green-400">
            {formatEur(monthNet)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">{thisMonth.length} payouts</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Comisiones Stripe este mes
          </p>
          <p className="mt-1 text-2xl font-bold text-red-500">
            {formatEur(monthFees)}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">
            Gasto a registrar contablemente (cuenta 626)
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
            Pendientes de conciliar
          </p>
          <p className="mt-1 text-2xl font-bold text-amber-600 dark:text-amber-400">
            {pendingCount}
          </p>
          <p className="mt-0.5 text-xs text-zinc-400">en los últimos 60 días</p>
        </div>
      </div>

      <PayoutsList payouts={payouts} />
    </div>
  );
}
