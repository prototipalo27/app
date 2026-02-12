import { createClient } from "@/lib/supabase/server";
import Link from "next/link";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data: lists } = await supabase
    .from("purchase_lists")
    .select("*, projects(name)")
    .order("created_at", { ascending: false });

  // Get item counts per list
  const { data: items } = await supabase
    .from("purchase_items")
    .select("purchase_list_id, status");

  const itemStats = new Map<
    string,
    { total: number; pending: number }
  >();
  items?.forEach((item) => {
    const existing = itemStats.get(item.purchase_list_id) || {
      total: 0,
      pending: 0,
    };
    existing.total++;
    if (item.status === "pending") existing.pending++;
    itemStats.set(item.purchase_list_id, existing);
  });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Listas de compras
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
                Proyecto
              </th>
              <th className="hidden px-4 py-3 font-medium text-zinc-700 md:table-cell dark:text-zinc-300">
                Fecha
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {lists && lists.length > 0 ? (
              lists.map((list) => {
                const stats = itemStats.get(list.id) || {
                  total: 0,
                  pending: 0,
                };
                const project = list.projects as { name: string } | null;
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
                    </td>
                    <td className="px-4 py-3 text-zinc-500 dark:text-zinc-400">
                      {stats.pending > 0 ? (
                        <span>
                          <span className="font-medium text-amber-600 dark:text-amber-400">
                            {stats.pending}
                          </span>
                          /{stats.total}
                        </span>
                      ) : (
                        `${stats.total}`
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
                      {project?.name || "—"}
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
                  colSpan={5}
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
