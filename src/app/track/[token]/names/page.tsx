import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import ClientNamesForm from "./client-names-form";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select("name")
    .eq("tracking_token", token)
    .single();

  return {
    title: project ? `${project.name} — Nombres` : "Nombres",
  };
}

export default async function ClientNamesPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, tracking_token")
    .eq("tracking_token", token)
    .single();

  if (!project) notFound();

  // Find name_list checklist items
  const { data: nameItems } = await supabase
    .from("project_checklist_items")
    .select("id, name, data")
    .eq("project_id", project.id)
    .eq("item_type", "name_list")
    .order("position");

  if (!nameItems || nameItems.length === 0) notFound();

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-zinc-900 dark:text-white">
            Prototipalo
          </span>
          <span className="text-xs text-zinc-400 dark:text-zinc-500">
            Formulario de nombres
          </span>
        </div>
      </header>

      <main className="mx-auto max-w-2xl px-4 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Rellena los nombres para tu proyecto. Cada entrada puede tener dos
            lineas (ej: nombre del premio y nombre de la persona).
          </p>
        </div>

        {nameItems.map((item) => {
          const existing = (
            item.data as { entries?: { line1: string; line2?: string; checked: boolean }[] } | null
          )?.entries;

          return (
            <div key={item.id} className="mb-6">
              <ClientNamesForm
                itemId={item.id}
                itemName={item.name}
                token={token}
                existingEntries={existing ?? []}
              />
            </div>
          );
        })}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Prototipalo &mdash; Taller de produccion
      </footer>
    </div>
  );
}
