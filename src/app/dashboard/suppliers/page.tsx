import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { requireRole } from "@/lib/rbac";

export default async function SuppliersPage() {
  await requireRole("manager");

  const supabase = await createClient();

  const { data: suppliers } = await supabase
    .from("suppliers")
    .select("*")
    .order("name");

  // Get payment counts without invoice per supplier
  const { data: pendingInvoices } = await supabase
    .from("supplier_payments")
    .select("supplier_id, amount")
    .eq("has_invoice", false);

  // Aggregate pending invoice counts and totals per supplier
  const pendingBySupplier = new Map<
    string,
    { count: number; total: number }
  >();
  pendingInvoices?.forEach((p) => {
    const existing = pendingBySupplier.get(p.supplier_id) || {
      count: 0,
      total: 0,
    };
    existing.count++;
    existing.total += p.amount;
    pendingBySupplier.set(p.supplier_id, existing);
  });

  // Current month pending invoices
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
    .toISOString()
    .split("T")[0];
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0)
    .toISOString()
    .split("T")[0];

  const { data: monthPending } = await supabase
    .from("supplier_payments")
    .select("supplier_id, amount, description")
    .eq("has_invoice", false)
    .gte("payment_date", monthStart)
    .lte("payment_date", monthEnd);

  const monthBySupplier = new Map<
    string,
    { count: number; total: number }
  >();
  monthPending?.forEach((p) => {
    const existing = monthBySupplier.get(p.supplier_id) || {
      count: 0,
      total: 0,
    };
    existing.count++;
    existing.total += p.amount;
    monthBySupplier.set(p.supplier_id, existing);
  });

  const monthName = now.toLocaleString("es-ES", { month: "long", year: "numeric" });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Proveedores
        </h1>
        <div className="flex items-center gap-3">
          <Link
            href="/dashboard/suppliers/products"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Catalogo
          </Link>
          <Link
            href="/dashboard/suppliers/new"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            + Nuevo proveedor
          </Link>
        </div>
      </div>

      {/* Suppliers table */}
      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Nombre
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Email
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Telefono
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Sin factura
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Holded
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {suppliers && suppliers.length > 0 ? (
              suppliers.map((s) => {
                const pending = pendingBySupplier.get(s.id);
                return (
                  <tr
                    key={s.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/suppliers/${s.id}`}
                        className="font-medium text-zinc-900 hover:text-green-600 dark:text-white dark:hover:text-green-400"
                      >
                        {s.name}
                      </Link>
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {s.email || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {s.phone ? (
                        <a
                          href={`tel:${s.phone}`}
                          className="hover:text-green-600 dark:hover:text-green-400"
                        >
                          {s.phone}
                        </a>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {pending && pending.count > 0 ? (
                        <span className="inline-flex items-center rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-800 dark:bg-amber-900/30 dark:text-amber-400">
                          {pending.count} ({pending.total.toFixed(2)}&euro;)
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">
                          —
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 md:table-cell">
                      {s.holded_contact_id ? (
                        <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                          Vinculado
                        </span>
                      ) : (
                        <span className="text-zinc-400 dark:text-zinc-600">
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={5}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No hay proveedores. Crea uno para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Monthly summary */}
      {monthBySupplier.size > 0 && (
        <div className="mt-8">
          <h2 className="mb-4 text-lg font-semibold text-zinc-900 dark:text-white">
            Facturas pendientes — {monthName}
          </h2>
          <div className="overflow-x-auto rounded-xl border border-amber-200 bg-amber-50 dark:border-amber-800/50 dark:bg-amber-900/10">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-amber-200 dark:border-amber-800/50">
                <tr>
                  <th className="px-4 py-3 font-medium text-amber-800 dark:text-amber-400">
                    Proveedor
                  </th>
                  <th className="px-4 py-3 font-medium text-amber-800 dark:text-amber-400">
                    Pagos sin factura
                  </th>
                  <th className="px-4 py-3 font-medium text-amber-800 dark:text-amber-400">
                    Total
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-amber-100 dark:divide-amber-800/30">
                {Array.from(monthBySupplier.entries()).map(
                  ([supplierId, info]) => {
                    const supplier = suppliers?.find(
                      (s) => s.id === supplierId
                    );
                    return (
                      <tr key={supplierId}>
                        <td className="px-4 py-3">
                          <Link
                            href={`/dashboard/suppliers/${supplierId}`}
                            className="font-medium text-amber-900 hover:text-amber-700 dark:text-amber-300 dark:hover:text-amber-200"
                          >
                            {supplier?.name || "—"}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-amber-800 dark:text-amber-400">
                          {info.count}
                        </td>
                        <td className="px-4 py-3 font-medium text-amber-900 dark:text-amber-300">
                          {info.total.toFixed(2)}&euro;
                        </td>
                      </tr>
                    );
                  }
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
