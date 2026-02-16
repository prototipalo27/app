import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import {
  updateTemplate,
  addTemplateItem,
  deleteTemplateItem,
  reorderTemplateItems,
} from "../actions";

export default async function EditTemplatePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("manager");
  const { id } = await params;
  const supabase = await createClient();

  const { data: template } = await supabase
    .from("project_templates")
    .select("*")
    .eq("id", id)
    .single();

  if (!template) notFound();

  const { data: items } = await supabase
    .from("template_checklist_items")
    .select("*")
    .eq("template_id", id)
    .order("position", { ascending: true });

  const checklistItems = items ?? [];

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/settings/templates"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Plantillas
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          {template.name}
        </h1>
      </div>

      {/* Template info */}
      <form
        action={async (formData: FormData) => {
          "use server";
          await updateTemplate(id, formData);
        }}
        className="mb-6 space-y-4 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Nombre
          </label>
          <input
            type="text"
            name="name"
            defaultValue={template.name}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Descripcion
          </label>
          <input
            type="text"
            name="description"
            defaultValue={template.description ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Guardar
        </button>
      </form>

      {/* Checklist items */}
      <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-4 text-sm font-semibold text-zinc-900 dark:text-white">
          Items del checklist
        </h2>

        {checklistItems.length > 0 ? (
          <div className="mb-4 space-y-2">
            {checklistItems.map((item, idx) => (
              <div
                key={item.id}
                className="flex items-center justify-between rounded-lg border border-zinc-100 px-3 py-2 dark:border-zinc-800"
              >
                <div className="flex items-center gap-3">
                  <span className="text-xs font-mono text-zinc-400">
                    {idx + 1}
                  </span>
                  <span className="text-sm text-zinc-900 dark:text-white">
                    {item.name}
                  </span>
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-medium ${
                      item.item_type === "name_list"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                    }`}
                  >
                    {item.item_type === "name_list" ? "Lista nombres" : "Checkbox"}
                  </span>
                </div>
                <div className="flex items-center gap-1">
                  {/* Move up */}
                  {idx > 0 && (
                    <form
                      action={async () => {
                        "use server";
                        const ids = checklistItems.map((i) => i.id);
                        [ids[idx - 1], ids[idx]] = [ids[idx], ids[idx - 1]];
                        await reorderTemplateItems(id, ids);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      </button>
                    </form>
                  )}
                  {/* Move down */}
                  {idx < checklistItems.length - 1 && (
                    <form
                      action={async () => {
                        "use server";
                        const ids = checklistItems.map((i) => i.id);
                        [ids[idx], ids[idx + 1]] = [ids[idx + 1], ids[idx]];
                        await reorderTemplateItems(id, ids);
                      }}
                    >
                      <button
                        type="submit"
                        className="rounded p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    </form>
                  )}
                  {/* Delete */}
                  <form
                    action={async () => {
                      "use server";
                      await deleteTemplateItem(item.id, id);
                    }}
                  >
                    <button
                      type="submit"
                      className="rounded p-1 text-zinc-400 hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-900/20 dark:hover:text-red-400"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </form>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="mb-4 text-sm text-zinc-500 dark:text-zinc-400">
            No hay items. Agrega el primero.
          </p>
        )}

        {/* Add item form */}
        <form
          action={async (formData: FormData) => {
            "use server";
            const name = (formData.get("item_name") as string)?.trim();
            const itemType = (formData.get("item_type") as string) || "checkbox";
            if (!name) return;
            await addTemplateItem(id, name, itemType);
          }}
          className="flex gap-2"
        >
          <input
            type="text"
            name="item_name"
            required
            placeholder="Nombre del item..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <select
            name="item_type"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="checkbox">Checkbox</option>
            <option value="name_list">Lista de nombres</option>
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Agregar
          </button>
        </form>
      </div>
    </div>
  );
}
