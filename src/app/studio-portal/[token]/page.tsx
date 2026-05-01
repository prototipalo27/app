import { Suspense } from "react";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { setCollaboratorName } from "./actions";
import { listFolderFiles } from "@/lib/google-drive/client";
import { formatDate, formatDateLong, formatTime } from "@/lib/dates";

const FOLDER_MIME = "application/vnd.google-apps.folder";

function formatBytes(bytes: string | null): string {
  if (!bytes) return "";
  const n = parseInt(bytes, 10);
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

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

  const { data: paymentsAll } = collaborator.can_see_payments
    ? await supabase
        .from("studio_payments")
        .select("*")
        .eq("studio_project_id", project.id)
        .order("position", { ascending: true })
    : { data: null };

  // Solo mostramos al cliente los hitos en los que aún tiene "trabajo"
  // pendiente (algo por pagar o ya facturado a la espera). Cuando todo
  // está cobrado, la sección desaparece — el dinero deja de aparecer.
  const pendingPayments = (paymentsAll ?? []).filter(
    (p) => p.status === "pendiente" || p.status === "facturado",
  );

  const { data: meetings } = collaborator.can_see_meetings
    ? await supabase
        .from("studio_meetings")
        .select("*")
        .eq("studio_project_id", project.id)
        .order("meeting_date", { ascending: false })
    : { data: null };

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
                · Entrega prevista {formatDate(project.expected_end_date)}
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

        {/* Pagos pendientes — solo aparece si el cliente tiene algo abierto */}
        {collaborator.can_see_payments && pendingPayments.length > 0 && (
          <Section title="Pagos pendientes">
            <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200 bg-white">
              {pendingPayments.map((p) => (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-zinc-900">{p.label}</p>
                    {p.due_date && (
                      <p className="text-xs text-zinc-500">
                        Vence {formatDate(p.due_date)}
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
          </Section>
        )}

        {/* Reuniones */}
        {collaborator.can_see_meetings && (
          <Section title="Reuniones">
            <MeetingsList meetings={meetings ?? []} />
          </Section>
        )}

        {/* Documentos */}
        {collaborator.can_see_documents && (
          <Section title="Documentos">
            <Suspense fallback={<p className="text-sm text-zinc-500">Cargando documentos…</p>}>
              <DocumentsList
                token={token}
                folderId={project.google_drive_folder_id ?? null}
              />
            </Suspense>
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

async function DocumentsList({
  token,
  folderId,
}: {
  token: string;
  folderId: string | null;
}) {
  if (!folderId) {
    return <p className="text-sm text-zinc-500">El equipo aún no ha creado la carpeta de documentos.</p>;
  }

  let rootFiles: Awaited<ReturnType<typeof listFolderFiles>> = [];
  try {
    rootFiles = await listFolderFiles(folderId);
  } catch (err) {
    console.error("[studio-portal] Error listing root files:", err);
    return <p className="text-sm text-red-600">No se han podido cargar los documentos.</p>;
  }

  const subfolders = rootFiles.filter((f) => f.mimeType === FOLDER_MIME);
  const rootFilesOnly = rootFiles.filter((f) => f.mimeType !== FOLDER_MIME);

  // Carga el contenido de cada subcarpeta en paralelo.
  const subfolderContents = await Promise.all(
    subfolders.map(async (folder) => {
      try {
        const items = await listFolderFiles(folder.id);
        return {
          folder,
          files: items.filter((f) => f.mimeType !== FOLDER_MIME),
        };
      } catch {
        return { folder, files: [] };
      }
    }),
  );

  const totalFiles =
    rootFilesOnly.length +
    subfolderContents.reduce((acc, s) => acc + s.files.length, 0);

  if (totalFiles === 0) {
    return <p className="text-sm text-zinc-500">Aún no hay documentos publicados.</p>;
  }

  return (
    <div className="space-y-5">
      {rootFilesOnly.length > 0 && (
        <FileGroup token={token} title="General" files={rootFilesOnly} />
      )}
      {subfolderContents
        .filter((s) => s.files.length > 0)
        .map((s) => (
          <FileGroup
            key={s.folder.id}
            token={token}
            title={s.folder.name}
            files={s.files}
          />
        ))}
    </div>
  );
}

function FileGroup({
  token,
  title,
  files,
}: {
  token: string;
  title: string;
  files: { id: string; name: string; mimeType: string; size: string | null; modifiedTime: string | null }[];
}) {
  return (
    <div>
      <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500">{title}</h3>
      <ul className="divide-y divide-zinc-100 rounded-lg border border-zinc-200">
        {files.map((f) => (
          <li key={f.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-zinc-900">{f.name}</p>
              <p className="text-xs text-zinc-500">
                {[formatBytes(f.size), f.modifiedTime ? formatDate(f.modifiedTime) : null]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <a
              href={`/api/studio-portal/${token}/files/${f.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
            >
              Abrir
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}

type PortalMeeting = {
  id: string;
  meeting_date: string;
  attendees: string[];
  summary: string | null;
  action_items: string | null;
  recording_url: string | null;
};

function MeetingsList({ meetings }: { meetings: PortalMeeting[] }) {
  if (meetings.length === 0) {
    return <p className="text-sm text-zinc-500">Aún no hay reuniones publicadas.</p>;
  }

  return (
    <ul className="space-y-4">
      {meetings.map((m) => {
        const dateLabel = formatDateLong(m.meeting_date);
        const timeLabel = formatTime(m.meeting_date);
        return (
          <li
            key={m.id}
            className="rounded-lg border border-zinc-200 bg-white p-4"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-sm font-semibold text-zinc-900">
                  {dateLabel}{" "}
                  <span className="font-normal text-zinc-500">· {timeLabel}</span>
                </p>
                {m.attendees.length > 0 && (
                  <p className="mt-0.5 text-xs text-zinc-500">
                    {m.attendees.join(", ")}
                  </p>
                )}
              </div>
              {m.recording_url && (
                <a
                  href={m.recording_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="shrink-0 rounded-lg border border-zinc-300 px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50"
                >
                  Ver grabación
                </a>
              )}
            </div>

            {m.summary && (
              <div className="mt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Resumen</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{m.summary}</p>
              </div>
            )}

            {m.action_items && (
              <div className="mt-3">
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500">Próximos pasos</p>
                <p className="mt-1 whitespace-pre-wrap text-sm text-zinc-700">{m.action_items}</p>
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
