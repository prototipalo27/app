interface BillingCardsProps {
  currentMonth: { total: number; count: number; label: string };
  previousMonth: { total: number; count: number; label: string };
}

function formatEur(amount: number) {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function BillingCards({ currentMonth, previousMonth }: BillingCardsProps) {
  const diff = previousMonth.total > 0
    ? ((currentMonth.total - previousMonth.total) / previousMonth.total) * 100
    : currentMonth.total > 0
      ? 100
      : 0;

  const isUp = diff > 0;
  const isDown = diff < 0;

  return (
    <div className="grid grid-cols-2 gap-3">
      {/* Current month */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {currentMonth.label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
          {formatEur(currentMonth.total)}
        </p>
        <div className="mt-1 flex items-center gap-2">
          <span className="text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
            {currentMonth.count} facturas
          </span>
          {diff !== 0 && (
            <span className={`flex items-center gap-0.5 text-xs font-medium ${isUp ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d={isUp ? "M5 15l7-7 7 7" : "M19 9l-7 7-7-7"} />
              </svg>
              {Math.abs(diff).toFixed(0)}%
            </span>
          )}
        </div>
      </div>

      {/* Previous month */}
      <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {previousMonth.label}
        </p>
        <p className="mt-1 text-2xl font-bold tabular-nums text-zinc-900 dark:text-white">
          {formatEur(previousMonth.total)}
        </p>
        <span className="mt-1 text-xs tabular-nums text-zinc-400 dark:text-zinc-500">
          {previousMonth.count} facturas
        </span>
      </div>
    </div>
  );
}
