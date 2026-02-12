import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("purchase_lists")
    .select("*, purchase_items(*)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Lista de compras
        </h1>
        <Link
          href="/dashboard/purchases/new"
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
        >
          + Nueva lista
        </Link>
      </div>

      <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <table className="w-full text-left text-sm">
          <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
            <tr>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Titulo
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Items
              </th>
              <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
                Estado
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {lists && lists.length > 0 ? (
              lists.map((list) => {
                const items = list.purchase_items || [];
                const pending = items.filter(
                  (i: { status: string | null }) => i.status === "pending"
                ).length;
                const total = items.length;

                return (
                  <tr
                    key={list.id}
                    className="hover:bg-zinc-50 dark:hover:bg-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/purchases/${list.id}`}
                        className="font-medium text-zinc-900 hover:text-green-600 dark:text-white dark:hover:text-green-400"
                      >
                        {list.title}
                      </Link>
                      {list.notes && (
                        <p className="mt-0.5 text-xs text-zinc-400">
                          {list.notes}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {pending > 0 ? (
                        <span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {pending}
                          </span>
                          {" / "}
                          {total}
                        </span>
                      ) : (
                        <span>{total}</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {list.status === "open" ? (
                        <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                          Abierta
                        </span>
                      ) : (
                        <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                          Cerrada
                        </span>
                      )}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 md:table-cell dark:text-zinc-400">
                      {list.created_at
                        ? new Date(list.created_at).toLocaleDateString("es-ES")
                        : "—"}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td
                  colSpan={4}
                  className="px-4 py-8 text-center text-zinc-500 dark:text-zinc-400"
                >
                  No hay listas de compras. Crea una para empezar.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
