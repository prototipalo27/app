import { createClient } from "@/lib/supabase/server";

interface Props {
  userId: string;
  employeeName: string;
}

export default async function EmployeeCommissions({ userId, employeeName }: Props) {
  const supabase = await createClient();

  // Get commission config for this user
  const { data: config } = await supabase
    .from("commission_configs")
    .select("*")
    .eq("user_id", userId)
    .maybeSingle();

  // Get won leads this month where this user is owner or closer
  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

  const { data: wonLeads } = await supabase
    .from("leads")
    .select("id, full_name, company, estimated_value, source, owned_by, assigned_to")
    .eq("status", "paid")
    .gte("updated_at", startOfMonth)
    .lte("updated_at", endOfMonth)
    .or(`owned_by.eq.${userId},assigned_to.eq.${userId}`);

  // Get quote totals for won leads
  const leadIds = (wonLeads || []).map((l) => l.id);
  let quotes: { lead_id: string; items: unknown }[] = [];
  if (leadIds.length > 0) {
    const { data } = await supabase
      .from("quote_requests")
      .select("lead_id, items")
      .in("lead_id", leadIds);
    quotes = data || [];
  }

  // Calculate commissions
  const newRate = config?.new_rate ?? 0;
  const returningRate = config?.returning_rate ?? 0;

  type DealLine = {
    clientName: string;
    total: number;
    rate: number;
    commission: number;
    role: "captador" | "closer";
    isReturning: boolean;
  };

  const deals: DealLine[] = [];
  let totalCommission = 0;
  let totalBilled = 0;

  for (const lead of wonLeads || []) {
    const qr = quotes.find((q) => q.lead_id === lead.id);
    const items = (qr?.items || []) as { price: number; units: number }[];
    const quoteTotal = items.reduce((s, i) => s + i.price * i.units, 0);
    const isReturning = lead.source === "recurring";
    const rate = isReturning ? returningRate : newRate;

    // Check if user is captador (owned_by) or closer (assigned_to)
    const isCaptador = lead.owned_by === userId;
    const isCloser = lead.assigned_to === userId;
    const commission = quoteTotal * (rate / 100);

    if (isCaptador || isCloser) {
      deals.push({
        clientName: lead.company || lead.full_name,
        total: quoteTotal,
        rate,
        commission,
        role: isCloser ? "closer" : "captador",
        isReturning,
      });
      totalCommission += commission;
      totalBilled += quoteTotal;
    }
  }

  const monthName = now.toLocaleDateString("es-ES", { month: "long", year: "numeric" });

  return (
    <div className="space-y-4">
      {/* Config summary */}
      {config ? (
        <div className="flex flex-wrap gap-2">
          <span className="rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400">
            Nuevo: {config.new_rate}%
          </span>
          <span className="rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
            Recurrente: {config.returning_rate}%
          </span>
          {config.prepaid_bonus > 0 && (
            <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-900/30 dark:text-amber-400">
              Bonus prepago: {config.prepaid_bonus}%
            </span>
          )}
        </div>
      ) : (
        <p className="text-sm text-zinc-400">Sin comisiones configuradas</p>
      )}

      {/* Monthly summary */}
      <div className="flex gap-3">
        <div className="flex-1 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
          <p className="text-[11px] text-zinc-500 dark:text-zinc-400 capitalize">{monthName}</p>
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
          <p className="text-[11px] text-zinc-400">{deals.length} operacion{deals.length !== 1 ? "es" : ""}</p>
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
              {deals.map((deal, i) => (
                <tr key={i} className="border-b border-zinc-100 dark:border-zinc-800">
                  <td className="py-2 pr-3">
                    <span className="font-medium text-zinc-900 dark:text-white">{deal.clientName}</span>
                    <div className="flex gap-1 mt-0.5">
                      <span className={`text-[10px] px-1.5 py-0 rounded-full ${
                        deal.role === "closer"
                          ? "bg-purple-100 text-purple-600 dark:bg-purple-900/30 dark:text-purple-400"
                          : "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        {deal.role}
                      </span>
                      <span className={`text-[10px] px-1.5 py-0 rounded-full ${
                        deal.isReturning
                          ? "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-emerald-100 text-emerald-600 dark:bg-emerald-900/30 dark:text-emerald-400"
                      }`}>
                        {deal.isReturning ? "recurrente" : "nuevo"}
                      </span>
                    </div>
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-600 dark:text-zinc-300">
                    {deal.total.toLocaleString("es-ES")} €
                  </td>
                  <td className="py-2 pr-3 text-right tabular-nums text-zinc-500">{deal.rate}%</td>
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
