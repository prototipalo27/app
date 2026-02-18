import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { updateSnippet, deleteSnippet } from "../actions";

const CATEGORIES = [
  { id: "saludo", label: "Saludo" },
  { id: "pagos", label: "Pagos" },
  { id: "envios", label: "Envíos" },
  { id: "plazos", label: "Plazos" },
  { id: "materiales", label: "Materiales" },
  { id: "cierre", label: "Cierre" },
] as const;

export default async function EditSnippetPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await requireRole("manager");
  const { id } = await params;
  const supabase = await createClient();

  const { data: snippet } = await supabase
    .from("email_snippets")
    .select("*")
    .eq("id", id)
    .single();

  if (!snippet) notFound();

  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard/settings/email-snippets"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a snippets
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          Editar snippet
        </h1>
      </div>

      <form
        action={async (formData: FormData) => {
          "use server";
          await updateSnippet(id, formData);
          redirect("/dashboard/settings/email-snippets");
        }}
        className="space-y-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Título
          </label>
          <input
            type="text"
            name="title"
            required
            defaultValue={snippet.title}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Categoría
          </label>
          <select
            name="category"
            required
            defaultValue={snippet.category}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Contenido
          </label>
          <textarea
            name="content"
            required
            rows={8}
            defaultValue={snippet.content}
            className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Guardar cambios
          </button>
        </div>
      </form>

      <form
        action={async () => {
          "use server";
          await deleteSnippet(id);
          redirect("/dashboard/settings/email-snippets");
        }}
        className="mt-4 flex justify-start"
      >
        <button
          type="submit"
          className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
        >
          Eliminar snippet
        </button>
      </form>
    </div>
  );
}
