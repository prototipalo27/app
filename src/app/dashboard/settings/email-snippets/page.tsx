import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { createSnippet, deleteSnippet } from "./actions";

const CATEGORIES = [
  { id: "saludo", label: "Saludo" },
  { id: "pagos", label: "Pagos" },
  { id: "envios", label: "Envíos" },
  { id: "plazos", label: "Plazos" },
  { id: "materiales", label: "Materiales" },
  { id: "cierre", label: "Cierre" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  saludo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pagos: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  envios: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  plazos: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  materiales: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cierre: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function EmailSnippetsPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: snippets } = await supabase
    .from("email_snippets")
    .select("*")
    .order("category")
    .order("sort_order", { ascending: true });

  // Group by category
  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    snippets: (snippets || []).filter((s) => s.category === cat.id),
  }));

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <Link
            href="/dashboard/crm"
            className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            &larr; Volver a CRM
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
            Frases de email
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Frases pre-hechas para insertar rápidamente en emails del CRM.
          </p>
        </div>
      </div>

      {/* New snippet form */}
      <form
        action={createSnippet}
        className="mb-6 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex gap-3">
          <input
            type="text"
            name="title"
            required
            placeholder="Título del snippet..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <select
            name="category"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="content"
          required
          rows={3}
          placeholder="Contenido del snippet..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Crear snippet
          </button>
        </div>
      </form>

      {/* Snippets grouped by category */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.id}>
            <div className="mb-2 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[group.id]}`}
              >
                {group.label}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {group.snippets.length} snippets
              </span>
            </div>

            {group.snippets.length > 0 ? (
              <div className="space-y-2">
                {group.snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {snippet.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                          {snippet.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/dashboard/settings/email-snippets/${snippet.id}`}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Editar
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await deleteSnippet(snippet.id);
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
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                Sin snippets en esta categoría.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

