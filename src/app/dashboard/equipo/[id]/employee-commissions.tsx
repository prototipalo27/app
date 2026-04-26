import { createClient } from "@/lib/supabase/server";
import { getUserMonthlyCommission } from "../../crm/actions";

interface Props {
  userId: string;
  employeeName: string;
}

export default async function EmployeeCommissions({ userId }: Props) {
  const supabase = await createClient();

  const { data: config } = await (supabase as any)
    .from("commission_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const data = await getUserMonthlyCommission(userId, year, month);

  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  if (!config) {
    return <p className="text-sm text-zinc-400">Sin comisiones configuradas</p>;
  }

  const isTiered = config.type === "tiered";
  const tiers = (config.tiers || []) as { min: number; max: number | null; rate: number }[];

  const totalCommission = data?.preview.monthlyCommission ?? 0;
  const totalBilled = data?.preview.monthlyBilled ?? 0;
  const currentRate = data?.preview.currentRate ?? 0;
  const deals = data?.deals ?? [];

  return (
    <div className="space-y-4">
      {/* Config summary */}
      <div className="flex flex-wrap gap-2">
        {isTiered ? (
          <>
            {tiers
              .slice()
              .sort((a, b) => a.min - b.min)
              .map((t, i) => {
                const isActive = totalBilled > t.min && (t.max === null || totalBilled <= t.max);
                return (
                  <span
                    key={i}
                    className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                      isActive
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {t.min.toLocaleString("es-ES")}–{t.max === null ? "∞" : t.max.toLocaleString("es-ES")} €: {(t.rate * 100).toFixed(1)}%
                  </span>
                );
              })}
          </>
        ) : (
          <>
            <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
              Nuevo: {(Number(config.new_rate) * 100).toFixed(1)}%
            </span>
            <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
              Recurrente: {(Number(config.returning_rate) * 100).toFixed(1)}%
            </span>
          </>
        )}
        {Number(config.prepaid_bonus) > 0 && (
          <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
            Bonus prepago: {(Number(config.prepaid_bonus) * 100).toFixed(1)}%
          </span>
        )}
      </div>

      {/* Monthly summary */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-[11px] capitalize text-zinc-500 dark:text-zinc-400">{monthName}</p>
          <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {totalCommission.toFixed(2)} €
          </p>
          <p className="text-[11px] text-zinc-400">comision generada</p>
        </div>
        <div className="flex-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400">Facturacion</p>
          <p className="text-xl font-bold tabular-nums text-zinc-900 dark:text-white">
            {totalBilled.toLocaleString("es-ES")} €
          </p>
          <p className="text-[11px] text-zinc-400">
            {deals.length} operacion{deals.length !== 1 ? "es" : ""}
            {isTiered && totalBilled > 0 && ` · tramo ${(currentRate * 100).toFixed(1)}%`}
          </p>
        </div>
      </div>

      {/* Deal breakdown */}
      {deals.length > 0 && (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs text-zinc-500 dark:text-zinc-400">
                <th className="pb-2 pr-3 font-medium">Cliente</th>
                <th className="pb-2 pr-3 text-right font-medium">Total</th>
                <th className="pb-2 pr-3 text-right font-medium">Tasa</th>
                <th className="pb-2 text-right font-medium">Comision</th>
              </tr>
            </thead>
            <tbody>
              {deals.map((deal) => (
                <tr key={deal.leadId} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-zinc-900 dark:text-white">{deal.clientName}</span>
                    <div className="mt-0.5 flex gap-1">
                      <span
                        className={`rounded-full px-1.5 py-0 text-[10px] ${
                          deal.role === "closer"
                            ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                            : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                        }`}
                      >
                        {deal.role}
                      </span>
                      {deal.role === "captador" && (
                        <span
                          className={`rounded-full px-1.5 py-0 text-[10px] ${
                            deal.isReturning
                              ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                              : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                          }`}
                        >
                          {deal.isReturning ? "recurrente" : "nuevo"}
                        </span>
                      )}
                      {deal.isPrepaid && (
                        <span className="rounded-full bg-amber-100 px-1.5 py-0 text-[10px] text-amber-600 dark:bg-amber-900/30 dark:text-amber-400">
                          100%
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                    {deal.total.toLocaleString("es-ES")} €
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">
                    {(deal.rate * 100).toFixed(1)}%
                  </td>
                  <td className="py-2 text-right font-semibold tabular-nums text-green-600 dark:text-green-400">
                    {deal.commission.toFixed(2)} €
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
