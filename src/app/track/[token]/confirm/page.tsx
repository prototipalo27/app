import { Suspense } from "react";
import Link from "next/link";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { getVerifiedSession } from "@/lib/client-auth";
import ClientNamesForm from "../names/client-names-form";
import ConfirmShippingButton from "./confirm-button";

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
    title: project ? `${project.name} — Confirmar envío` : "Confirmar envío",
  };
}

type ChecklistData = {
  entries?: { line1: string; line2?: string; checked: boolean }[];
  photo_path?: string;
  photo_uploaded_at?: string;
};

export default async function ConfirmPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50 dark:bg-black" />}>
      <ConfirmContent params={params} />
    </Suspense>
  );
}

async function ConfirmContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, tracking_token, client_confirmed_at, client_confirmed_by")
    .eq("tracking_token", token)
    .single();

  if (!project) notFound();

  const session = await getVerifiedSession();
  if (!session || session.projectId !== project.id) {
    redirect(`/track/${token}?verify=1`);
  }

  const { data: items } = await supabase
    .from("project_checklist_items")
    .select("id, name, item_type, data")
    .eq("project_id", project.id)
    .in("item_type", ["name_list", "photo_qc"])
    .order("position");

  const nameItems = (items ?? []).filter((i) => i.item_type === "name_list");
  const photoItems = (items ?? []).filter(
    (i) => i.item_type === "photo_qc" && (i.data as ChecklistData | null)?.photo_path,
  );

  const alreadyConfirmed = !!project.client_confirmed_at;

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-zinc-950">
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
          <span className="text-lg font-bold text-zinc-900 dark:text-white">
            Prototipalo
          </span>
          <Link
            href={`/track/${token}`}
            className="text-xs text-zinc-400 hover:text-zinc-700 dark:hover:text-zinc-200"
          >
            ← Volver
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {project.name}
          </h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Revisa los nombres y las fotos de control de calidad antes de que enviemos tu pedido.
          </p>
        </div>

        {alreadyConfirmed && (
          <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/10">
            <p className="text-sm font-medium text-green-700 dark:text-green-400">
              ✓ Confirmado el {new Date(project.client_confirmed_at!).toLocaleString("es-ES")}
              {project.client_confirmed_by ? ` por ${project.client_confirmed_by}` : ""}
            </p>
            <p className="mt-1 text-xs text-green-600 dark:text-green-500">
              Si necesitas algún cambio contacta con nosotros lo antes posible.
            </p>
          </div>
        )}

        {/* Nombres */}
        {nameItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Nombres / inscripciones
            </h2>
            {nameItems.map((item) => {
              const existing = (item.data as ChecklistData | null)?.entries;
              return (
                <ClientNamesForm
                  key={item.id}
                  itemId={item.id}
                  itemName={item.name}
                  token={token}
                  existingEntries={existing ?? []}
                />
              );
            })}
          </section>
        )}

        {/* Fotos QC */}
        {photoItems.length > 0 && (
          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
              Fotos de control de calidad
            </h2>
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {photoItems.map((item) => (
                <a
                  key={item.id}
                  href={`/api/track/qc-photos/${item.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group block overflow-hidden rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="aspect-square overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={`/api/track/qc-photos/${item.id}`}
                      alt={item.name}
                      className="h-full w-full object-cover transition-transform group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <p className="border-t border-zinc-100 px-2 py-1.5 text-xs text-zinc-700 dark:border-zinc-800 dark:text-zinc-300">
                    {item.name}
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}

        {nameItems.length === 0 && photoItems.length === 0 && (
          <div className="rounded-xl border border-zinc-200 bg-white p-5 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
            Aún no hay nombres ni fotos disponibles. Vuelve más tarde.
          </div>
        )}

        {!alreadyConfirmed && (nameItems.length > 0 || photoItems.length > 0) && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-900/50 dark:bg-amber-900/10">
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-300">
              Confirmación final
            </h2>
            <p className="mt-1 text-xs text-amber-800 dark:text-amber-400">
              Al confirmar, autorizas el envío con los nombres y la calidad mostrados arriba. Una vez producido y enviado no podemos rehacer las piezas sin coste adicional.
            </p>
            <div className="mt-3">
              <ConfirmShippingButton token={token} />
            </div>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 py-6 text-center text-xs text-zinc-400 dark:border-zinc-800 dark:text-zinc-500">
        Prototipalo &mdash; Taller de produccion
      </footer>
    </div>
  );
}
