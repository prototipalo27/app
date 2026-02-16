import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createTemplate, deleteTemplate } from "./actions";

export default async function TemplatesPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: templates } = await supabase
    .from("project_templates")
    .select("*, template_checklist_items(id)")
    .order("created_at", { ascending: false });

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Plantillas de proyecto
        </h1>
      </div>

      {/* New template form */}
      <form
        action={createTemplate}
        className="mb-6 flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input
          type="text"
          name="name"
          required
          placeholder="Nombre de plantilla..."
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <input
          type="text"
          name="description"
          placeholder="Descripcion (opcional)"
          className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <button
          type="submit"
          className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
        >
          Nueva plantilla
        </button>
      </form>

      {/* Template list */}
      <div className="space-y-3">
        {templates && templates.length > 0 ? (
          templates.map((t) => (
            <div
              key={t.id}
              className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
            >
              <div>
                <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                  {t.name}
                </h3>
                {t.description && (
                  <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
                    {t.description}
                  </p>
                )}
                <p className="mt-1 text-xs text-zinc-400 dark:text-zinc-500">
                  {t.template_checklist_items.length} items
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Link
                  href={`/dashboard/settings/templates/${t.id}`}
                  className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                >
                  Editar
                </Link>
                <form
                  action={async () => {
                    "use server";
                    await deleteTemplate(t.id);
                  }}
                >
                  <button
                    type="submit"
                    className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                  >
                    Eliminar
                  </button>
                </form>
              </div>
            </div>
          ))
        ) : (
          <p className="py-8 text-center text-sm text-zinc-500 dark:text-zinc-400">
            No hay plantillas creadas.
          </p>
        )}
      </div>
    </div>
  );
}
