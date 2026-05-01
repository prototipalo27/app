import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setCollaboratorName } from "./actions";

const STATUS_LABELS: Record<string, string> = {
  brief: "Brief",
  propuesta: "Propuesta",
  en_curso: "En curso",
  entregado: "Entregado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  brief: "bg-zinc-100 text-zinc-700",
  propuesta: "bg-purple-100 text-purple-700",
  en_curso: "bg-blue-100 text-blue-700",
  entregado: "bg-green-100 text-green-700",
  cerrado: "bg-zinc-200 text-zinc-600",
  cancelado: "bg-red-100 text-red-700",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  facturado: "Facturado",
  cobrado: "Cobrado",
  cancelado: "Cancelado",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700",
  facturado: "bg-blue-100 text-blue-700",
  cobrado: "bg-green-100 text-green-700",
  cancelado: "bg-zinc-100 text-zinc-500",
};

function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data } = await supabase
    .from("studio_project_collaborators")
    .select("studio_projects(name)")
    .eq("token", token)
    .single();

  const project = data?.studio_projects as { name: string } | null;
  return { title: project ? `${project.name} — Studio` : "Studio" };
}

export default async function StudioPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-50" />}>
      <StudioPortalContent params={params} />
    </Suspense>
  );
}

async function StudioPortalContent({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  const { data: collaborator } = await supabase
    .from("studio_project_collaborators")
    .select("*")
    .eq("token", token)
    .single();

  if (!collaborator) notFound();

  // Marca la visita (sin esperar al resultado para no bloquear).
  await supabase
    .from("studio_project_collaborators")
    .update({ last_viewed_at: new Date().toISOString() })
    .eq("id", collaborator.id);

  const { data: project } = await supabase
    .from("studio_projects")
    .select("*")
    .eq("id", collaborator.studio_project_id)
    .single();

  if (!project) notFound();

  // Primera visita sin nombre → pedirlo antes de mostrar nada.
  if (!collaborator.name || !collaborator.name.trim()) {
    return <NamePrompt token={token} />;
  }

  const { data: payments } = collaborator.can_see_payments
    ? await supabase
        .from("studio_payments")
        .select("*")
        .eq("studio_project_id", project.id)
        .order("position", { ascending: true })
    : { data: null };

  const total = Number(project.total_price ?? 0);
  const cobrado = (payments ?? [])
    .filter((p) => p.status === "cobrado")
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const statusLabel = STATUS_LABELS[project.status] ?? project.status;
  const statusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.brief;

  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
        {/* Header */}
        <div className="mb-8 text-center">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Prototipalo Studio
          </p>
          <h1 className="mt-2 text-3xl font-bold text-zinc-900">{project.name}</h1>
          <div className="mt-3 flex items-center justify-center gap-2">
            <span className={`rounded-full px-3 py-1 text-xs font-medium ${statusColor}`}>
              {statusLabel}
            </span>
            {project.expected_end_date && (
              <span className="text-xs text-zinc-500">
                · Entrega prevista {new Date(project.expected_end_date).toLocaleDateString("es-ES")}
              </span>
            )}
          </div>
          <p className="mt-4 text-sm text-zinc-500">
            Hola {collaborator.name}, este es tu portal del proyecto. Guarda este link en favoritos para volver cuando quieras.
          </p>
        </div>

        {/* Brief */}
        {collaborator.can_see_brief && (
          <Section title="Brief del proyecto">
            {project.brief_description ? (
              <Paragraph label="Descripción" value={project.brief_description} />
            ) : null}
            {project.brief_objectives ? (
              <Paragraph label="Objetivos" value={project.brief_objectives} />
            ) : null}
            {project.brief_constraints ? (
              <Paragraph label="Restricciones" value={project.brief_constraints} />
            ) : null}
            {project.brief_references ? (
              <Paragraph label="Referencias" value={project.brief_references} />
            ) : null}
            {!project.brief_description &&
              !project.brief_objectives &&
              !project.brief_constraints &&
              !project.brief_references && (
                <p className="text-sm text-zinc-500">El equipo aún no ha publicado el brief.</p>
              )}
          </Section>
        )}

        {/* Pagos */}
        {collaborator.can_see_payments && (
          <Section title="Hitos de pago">
            {total > 0 && (
              <div className="mb-4 grid gap-3 sm:grid-cols-2">
                <Stat label="Total" value={formatEur(total)} />
                <Stat label="Cobrado" value={formatEur(cobrado)} accent="green" />
              </div>
            )}
            {payments && payments.length > 0 ? (
              <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
                {payments.map((p) => (
                  <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-zinc-900">{p.label}</p>
                      {p.due_date && (
                        <p className="text-xs text-zinc-500">
                          Vence {new Date(p.due_date).toLocaleDateString("es-ES")}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-semibold text-zinc-900">
                        {formatEur(Number(p.amount))}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                          PAYMENT_STATUS_COLORS[p.status] ?? PAYMENT_STATUS_COLORS.pendiente
                        }`}
                      >
                        {PAYMENT_STATUS_LABELS[p.status] ?? p.status}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-zinc-500">Aún no hay hitos de pago publicados.</p>
            )}
          </Section>
        )}

        {/* Reuniones — placeholder hasta Fase 3 */}
        {collaborator.can_see_meetings && (
          <Section title="Reuniones">
            <p className="text-sm text-zinc-500">Las reuniones aparecerán aquí cuando el equipo las publique.</p>
          </Section>
        )}

        {/* Documentos — placeholder hasta Fase 3 */}
        {collaborator.can_see_documents && (
          <Section title="Documentos">
            <p className="text-sm text-zinc-500">Los documentos del proyecto aparecerán aquí.</p>
          </Section>
        )}

        <p className="mt-8 text-center text-xs text-zinc-400">
          ¿Algún problema con el portal? Contacta con tu equipo de Prototipalo.
        </p>
      </div>
    </div>
  );
}

function NamePrompt({ token }: { token: string }) {
  return (
    <div className="min-h-screen bg-zinc-50">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-zinc-200 bg-white p-8 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-widest text-zinc-500">
            Prototipalo Studio
          </p>
          <h1 className="mt-2 text-2xl font-bold text-zinc-900">Bienvenido</h1>
          <p className="mt-2 text-sm text-zinc-600">
            Antes de empezar, dinos cómo llamarte para que el equipo sepa quién está mirando el portal.
          </p>
          <form action={setCollaboratorName} className="mt-6 space-y-4">
            <input type="hidden" name="token" value={token} />
            <div>
              <label className="block text-sm font-medium text-zinc-700">Tu nombre</label>
              <input
                type="text"
                name="name"
                required
                autoFocus
                placeholder="ej. María García"
                className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-zinc-900 focus:ring-1 focus:ring-zinc-900 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg bg-zinc-900 px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
            >
              Entrar al portal
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6 rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-lg font-semibold text-zinc-900">{title}</h2>
      {children}
    </section>
  );
}

function Paragraph({ label, value }: { label: string; value: string }) {
  return (
    <div className="mb-4 last:mb-0">
      <p className="text-xs font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{value}</p>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string; accent?: "green" }) {
  return (
    <div className="rounded-lg border border-zinc-200 p-3">
      <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">{label}</p>
      <p className={`mt-1 text-lg font-bold ${accent === "green" ? "text-green-600" : "text-zinc-900"}`}>
        {value}
      </p>
    </div>
  );
}
