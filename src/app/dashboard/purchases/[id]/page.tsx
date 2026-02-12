import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import PurchaseItems from "./purchase-items";

export default async function PurchaseListDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();

  const { data: list } = await supabase
    .from("purchase_lists")
    .select("*")
    .eq("id", id)
    .single();

  if (!list) notFound();

  const { data: items } = await supabase
    .from("purchase_items")
    .select("*")
    .eq("purchase_list_id", id)
    .order("created_at", { ascending: true });

  // If linked to a project, fetch project name
  let projectName: string | null = null;
  if (list.project_id) {
    const { data: project } = await supabase
      .from("projects")
      .select("name")
      .eq("id", list.project_id)
      .single();
    projectName = project?.name || null;
  }

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/purchases"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a listas
        </Link>
      </div>

      {/* List info */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
              {list.title}
            </h1>
            <div className="mt-1 flex items-center gap-2">
              {list.status === "open" ? (
                <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800 dark:bg-green-900/30 dark:text-green-400">
                  Abierta
                </span>
              ) : (
                <span className="inline-flex items-center rounded-full bg-zinc-100 px-2.5 py-0.5 text-xs font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                  Cerrada
                </span>
              )}
              {projectName && (
                <span className="text-xs text-zinc-500 dark:text-zinc-400">
                  Proyecto: {projectName}
                </span>
              )}
            </div>
          </div>
        </div>
        {list.notes && (
          <p className="mt-3 text-sm text-zinc-500 dark:text-zinc-400">
            {list.notes}
          </p>
        )}
      </div>

      <PurchaseItems
        listId={list.id}
        listStatus={list.status || "open"}
        items={items || []}
      />
    </div>
  );
}
