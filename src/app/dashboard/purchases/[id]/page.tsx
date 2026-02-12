import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import { deletePurchaseList } from "../actions";
import PurchaseItems from "./purchase-items";
import ListStatusToggle from "./list-status-toggle";

export default async function PurchaseListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("purchase_lists")
    .select("*, projects(name)")
    .eq("id", id)
    .single();

  if (!list) notFound();

  const { data: items } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_list_id", id)
    .order("created_at", { ascending: true });

  const project = list.projects as { name: string } | null;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/purchases"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a listas de compras
        </Link>
      </div>

      {/* List header */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
                {list.title}
              </h1>
              {list.status === "open" ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Abierta
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Cerrada
                </span>
              )}
            </div>
            {project && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                Proyecto: {project.name}
              </p>
            )}
            {list.notes && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
                {list.notes}
              </p>
            )}
          </div>

          <div className="flex items-center gap-2">
            <ListStatusToggle listId={list.id} status={list.status || "open"} />
            <form action={deletePurchaseList}>
              <input type="hidden" name="id" value={list.id} />
              <button
                type="submit"
                className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                onClick={(e) => {
                  if (!confirm("Eliminar esta lista y todos sus items?")) {
                    e.preventDefault();
                  }
                }}
              >
                Eliminar
              </button>
            </form>
          </div>
        </div>
      </div>

      {/* Items management */}
      <PurchaseItems
        listId={list.id}
        items={items || []}
        isOpen={list.status === "open"}
      />
    </div>
  );
}
