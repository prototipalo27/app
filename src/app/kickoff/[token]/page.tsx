import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { getDefaultDesignerName } from "@/lib/google-calendar/kickoff";
import { SlotButtons } from "./slot-buttons";
import { confirmKickoffSlot } from "./actions";

export const metadata: Metadata = {
  title: "Reserva tu reunión — Prototipalo",
  robots: { index: false, follow: false },
};

export default async function KickoffPage({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  return (
    <Suspense fallback={<Shell><div className="h-40" /></Shell>}>
      <KickoffContent params={params} searchParams={searchParams} />
    </Suspense>
  );
}

async function KickoffContent({
  params,
  searchParams,
}: {
  params: Promise<{ token: string }>;
  searchParams: Promise<{ slot?: string }>;
}) {
  const { token } = await params;
  const { slot: slotFromUrl } = await searchParams;

  // Si el cliente vino desde un botón del email (?slot=<iso>), confirmamos
  // directamente sin mostrarle los 3 botones otra vez. La acción ya valida
  // que el slot esté en kickoff_proposed_slots y redirige a /kickoff/<token>
  // (sin query) al terminar, que renderiza la página de "gracias".
  if (slotFromUrl) {
    await confirmKickoffSlot(token, slotFromUrl);
    // Si la acción no redirige (por error), seguimos al render normal.
  }

  const supabase = createServiceClient();
  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, client_name, lead_id, kickoff_proposed_slots, kickoff_confirmed_slot, kickoff_confirmed_at, kickoff_meeting_link",
    )
    .eq("kickoff_token", token)
    .maybeSingle();

  if (!project) notFound();

  // Resolvemos un nombre para el saludo: client_name del proyecto, o full_name del lead.
  let displayName = project.client_name ?? null;
  if (!displayName && project.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("full_name")
      .eq("id", project.lead_id)
      .maybeSingle();
    displayName = lead?.full_name ?? null;
  }
  // Mostramos el primer nombre, suena más cercano.
  const firstName = (displayName ?? "").trim().split(/\s+/)[0] || null;
  const designerName = getDefaultDesignerName();

  // ── Estado 1: ya confirmado → página de "gracias" ──────────────────
  if (project.kickoff_confirmed_at && project.kickoff_confirmed_slot) {
    const when = formatFullSlot(project.kickoff_confirmed_slot);
    return (
      <Shell>
        <div className="text-center">
          <div className="mx-auto mb-6 flex h-14 w-14 items-center justify-center rounded-full bg-green-100 text-green-700">
            <svg className="h-8 w-8" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h1 className="text-2xl font-semibold text-zinc-900">
            {firstName ? `Gracias ${firstName},` : "¡Gracias!"}
          </h1>
          <p className="mt-2 text-zinc-600">
            Has confirmado tu reunión con <strong>{designerName}</strong>.
          </p>
          <p className="mt-4 text-lg font-medium text-zinc-900">{when}</p>
          <p className="mt-2 text-sm text-zinc-500">
            Te hemos mandado el invite por email — añádelo a tu calendario.
          </p>
          {project.kickoff_meeting_link && (
            <div className="mt-8">
              <a
                href={project.kickoff_meeting_link}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-2 rounded-xl bg-zinc-900 px-6 py-3 text-sm font-semibold text-white hover:bg-zinc-800"
              >
                <svg className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
                Entrar a Google Meet
              </a>
            </div>
          )}
        </div>
      </Shell>
    );
  }

  const slots = Array.isArray(project.kickoff_proposed_slots)
    ? (project.kickoff_proposed_slots as string[]).filter(
        (s) => new Date(s).getTime() > Date.now(),
      )
    : [];

  // ── Estado 2: sin slots disponibles (caducaron o no se generaron) ──
  if (slots.length === 0) {
    return (
      <Shell>
        <div className="text-center">
          <h1 className="text-2xl font-semibold text-zinc-900">
            Reserva tu reunión con {designerName}
          </h1>
          <p className="mt-3 text-zinc-600">
            Los huecos propuestos ya no están disponibles. Escríbenos por email y
            te buscamos otro a tu medida.
          </p>
        </div>
      </Shell>
    );
  }

  // ── Estado 3: pendiente — mostramos los 3 botones ──────────────────
  return (
    <Shell>
      <div>
        <h1 className="text-2xl font-semibold text-zinc-900">
          {firstName ? `Hola ${firstName},` : "¡Hola!"}
        </h1>
        <p className="mt-2 text-zinc-600">
          Tu diseñadora es <strong>{designerName}</strong>. Elige el hueco que mejor te venga
          para vuestra primera reunión (30 min, por Google Meet).
        </p>
        <div className="mt-8">
          <SlotButtons token={token} slots={slots} />
        </div>
        <p className="mt-6 text-xs text-zinc-500">
          ¿No te encaja ninguno? Responde al email que te enviamos y te buscamos otro
          hueco.
        </p>
      </div>
    </Shell>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-xl px-4 py-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          {children}
        </div>
      </div>
    </div>
  );
}

function formatFullSlot(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
