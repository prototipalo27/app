import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { getUserProfile, hasRole } from "@/lib/rbac";
import {
  updateStudioProjectBrief,
  updateStudioProjectStatus,
  deleteStudioProject,
  addStudioPayment,
  updateStudioPayment,
  deleteStudioPayment,
} from "../actions";
import {
  addStudioCollaborator,
  updateStudioCollaboratorAccess,
  deleteStudioCollaborator,
} from "../collaborator-actions";
import {
  addStudioMeeting,
  updateStudioMeeting,
  deleteStudioMeeting,
} from "../meeting-actions";
import { CopyPortalLink } from "./copy-portal-link";
import { ProjectDocuments } from "../../projects/[id]/project-documents";
import { formatDateTime, toMadridDateTimeInput } from "@/lib/dates";

const STATUSES = [
  { value: "brief", label: "Brief" },
  { value: "propuesta", label: "Propuesta" },
  { value: "en_curso", label: "En curso" },
  { value: "entregado", label: "Entregado" },
  { value: "cerrado", label: "Cerrado" },
  { value: "cancelado", label: "Cancelado" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  brief: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  propuesta: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  en_curso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  entregado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cerrado: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const PAYMENT_STATUS_LABELS: Record<string, string> = {
  pendiente: "Pendiente",
  facturado: "Facturado",
  cobrado: "Cobrado",
  cancelado: "Cancelado",
};

const PAYMENT_STATUS_COLORS: Record<string, string> = {
  pendiente: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  facturado: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  cobrado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cancelado: "bg-zinc-100 text-zinc-500 dark:bg-zinc-800 dark:text-zinc-500",
};

type Tab = "brief" | "pagos" | "documentos" | "reuniones" | "accesos";

function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export default async function StudioProjectDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await params;
  const { tab: tabParam } = await searchParams;
  const tab: Tab =
    tabParam === "pagos"
      ? "pagos"
      : tabParam === "documentos"
        ? "documentos"
        : tabParam === "reuniones"
          ? "reuniones"
          : tabParam === "accesos"
            ? "accesos"
            : "brief";

  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  const canDelete = hasRole(profile.role, "manager");

  const supabase = await createClient();

  const [{ data: project }, { data: activeUsers }] = await Promise.all([
    supabase.from("studio_projects").select("*").eq("id", id).single(),
    supabase
      .from("user_profiles")
      .select("id, full_name, nickname, email")
      .eq("is_active", true),
  ]);

  if (!project) notFound();

  const [{ data: payments }, { data: collaborators }, { data: meetings }] =
    await Promise.all([
      supabase
        .from("studio_payments")
        .select("*")
        .eq("studio_project_id", id)
        .order("position", { ascending: true }),
      supabase
        .from("studio_project_collaborators")
        .select("*")
        .eq("studio_project_id", id)
        .order("created_at", { ascending: true }),
      supabase
        .from("studio_meetings")
        .select("*")
        .eq("studio_project_id", id)
        .order("meeting_date", { ascending: false }),
    ]);

  const total = Number(project.total_price ?? 0);
  const cobrado = (payments ?? [])
    .filter((p) => p.status === "cobrado")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const facturado = (payments ?? [])
    .filter((p) => p.status === "facturado")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const planificado = (payments ?? [])
    .filter((p) => p.status !== "cancelado")
    .reduce((acc, p) => acc + Number(p.amount), 0);

  const statusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.brief;
  const statusLabel = STATUSES.find((s) => s.value === project.status)?.label ?? project.status;

  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-6">
        <Link
          href="/dashboard/studio"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a Studio
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h1 className="truncate text-2xl font-bold text-zinc-900 dark:text-white">{project.name}</h1>
            {project.client_name && (
              <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">{project.client_name}</p>
            )}
          </div>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${statusColor}`}>
            {statusLabel}
          </span>
        </div>

        {/* Status quick-update */}
        <form action={updateStudioProjectStatus} className="mt-4 flex flex-wrap items-center gap-2">
          <input type="hidden" name="id" value={project.id} />
          <select
            name="status"
            defaultValue={project.status}
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {STATUSES.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-zinc-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
          >
            Cambiar estado
          </button>
        </form>
      </div>

      {/* KPIs pagos */}
      <div className="mb-6 grid gap-3 sm:grid-cols-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Total</p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{formatEur(total)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Planificado</p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{formatEur(planificado)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Facturado</p>
          <p className="mt-1 text-lg font-bold text-blue-600 dark:text-blue-400">{formatEur(facturado)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cobrado</p>
          <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">{formatEur(cobrado)}</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex gap-1">
          <TabLink id={project.id} tab="brief" current={tab} label="Brief" />
          <TabLink id={project.id} tab="pagos" current={tab} label="Pagos" />
          <TabLink id={project.id} tab="documentos" current={tab} label="Documentos" />
          <TabLink
            id={project.id}
            tab="reuniones"
            current={tab}
            label={`Reuniones${meetings && meetings.length > 0 ? ` (${meetings.length})` : ""}`}
          />
          <TabLink
            id={project.id}
            tab="accesos"
            current={tab}
            label={`Accesos${collaborators && collaborators.length > 0 ? ` (${collaborators.length})` : ""}`}
          />
        </nav>
      </div>

      {tab === "brief" && (
        <BriefTab
          project={project}
          activeUsers={activeUsers ?? []}
          canDelete={canDelete}
        />
      )}

      {tab === "pagos" && (
        <PagosTab
          projectId={project.id}
          payments={payments ?? []}
          total={total}
        />
      )}

      {tab === "documentos" && (
        <ProjectDocuments
          projectId={project.id}
          folderId={project.google_drive_folder_id}
          kind="studio"
        />
      )}

      {tab === "reuniones" && (
        <ReunionesTab
          projectId={project.id}
          meetings={meetings ?? []}
        />
      )}

      {tab === "accesos" && (
        <AccesosTab
          projectId={project.id}
          collaborators={collaborators ?? []}
        />
      )}
    </div>
  );
}

function TabLink({ id, tab, current, label }: { id: string; tab: Tab; current: Tab; label: string }) {
  const active = tab === current;
  return (
    <Link
      href={`/dashboard/studio/${id}?tab=${tab}`}
      className={`-mb-px border-b-2 px-4 py-2 text-sm font-medium transition ${
        active
          ? "border-brand text-zinc-900 dark:text-white"
          : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
      }`}
    >
      {label}
    </Link>
  );
}

type StudioProject = {
  id: string;
  name: string;
  status: string;
  client_name: string | null;
  client_email: string | null;
  total_price: number | null;
  start_date: string | null;
  expected_end_date: string | null;
  brief_description: string | null;
  brief_objectives: string | null;
  brief_constraints: string | null;
  brief_references: string | null;
  notes: string | null;
  project_manager_id: string | null;
  google_drive_folder_id: string | null;
  created_at: string;
  updated_at: string;
};

function BriefTab({
  project,
  activeUsers,
  canDelete,
}: {
  project: StudioProject;
  activeUsers: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  canDelete: boolean;
}) {
  return (
    <div className="space-y-6">
      <form
        action={updateStudioProjectBrief}
        className="space-y-5 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <input type="hidden" name="id" value={project.id} />

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Nombre</label>
          <input
            type="text"
            name="name"
            defaultValue={project.name}
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Cliente</label>
            <input
              type="text"
              name="client_name"
              defaultValue={project.client_name ?? ""}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Email cliente</label>
            <input
              type="email"
              name="client_email"
              defaultValue={project.client_email ?? ""}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Precio total</label>
            <div className="relative mt-1">
              <input
                type="number"
                name="total_price"
                step="0.01"
                min="0"
                defaultValue={project.total_price ?? ""}
                className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">&euro;</span>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Inicio</label>
            <input
              type="date"
              name="start_date"
              defaultValue={project.start_date ?? ""}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Entrega prevista</label>
            <input
              type="date"
              name="expected_end_date"
              defaultValue={project.expected_end_date ?? ""}
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Project Manager</label>
          <select
            name="project_manager_id"
            defaultValue={project.project_manager_id ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="">Sin asignar</option>
            {activeUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nickname || u.full_name || u.email.split("@")[0]}
              </option>
            ))}
          </select>
        </div>

        <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Brief del cliente</h3>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Descripción</label>
            <textarea
              name="brief_description"
              rows={4}
              defaultValue={project.brief_description ?? ""}
              placeholder="Qué nos ha contado el cliente, contexto, problema que quiere resolver..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Objetivos</label>
            <textarea
              name="brief_objectives"
              rows={3}
              defaultValue={project.brief_objectives ?? ""}
              placeholder="Qué tiene que conseguir el proyecto, KPIs, entregables esperados..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Restricciones</label>
            <textarea
              name="brief_constraints"
              rows={3}
              defaultValue={project.brief_constraints ?? ""}
              placeholder="Materiales, presupuesto, tiempos, normativa, patentes existentes..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Referencias</label>
            <textarea
              name="brief_references"
              rows={3}
              defaultValue={project.brief_references ?? ""}
              placeholder="Links, productos parecidos, referencias visuales..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">Notas internas</label>
          <textarea
            name="notes"
            rows={2}
            defaultValue={project.notes ?? ""}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
        </div>

        <div className="flex justify-end border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Guardar cambios
          </button>
        </div>
      </form>

      {canDelete && (
        <div className="rounded-xl border border-red-200 bg-white p-5 dark:border-red-900/50 dark:bg-zinc-900">
          <h2 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">Zona peligrosa</h2>
          <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
            Eliminar el proyecto borrará también reuniones, pagos y documentos asociados.
          </p>
          <form action={deleteStudioProject}>
            <input type="hidden" name="id" value={project.id} />
            <button
              type="submit"
              className="rounded-lg border border-red-300 px-3 py-1.5 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-900/50 dark:text-red-400 dark:hover:bg-red-900/10"
            >
              Eliminar proyecto
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

type Payment = {
  id: string;
  studio_project_id: string;
  label: string;
  amount: number;
  due_date: string | null;
  status: string;
  paid_at: string | null;
  position: number;
};

function PagosTab({
  projectId,
  payments,
  total,
}: {
  projectId: string;
  payments: Payment[];
  total: number;
}) {
  const planificado = payments
    .filter((p) => p.status !== "cancelado")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const sinPlanificar = total > 0 ? total - planificado : 0;

  return (
    <div className="space-y-6">
      {total > 0 && Math.abs(sinPlanificar) > 0.01 && (
        <div
          className={`rounded-lg border p-3 text-sm ${
            sinPlanificar > 0
              ? "border-amber-200 bg-amber-50 text-amber-800 dark:border-amber-900/50 dark:bg-amber-900/10 dark:text-amber-300"
              : "border-red-200 bg-red-50 text-red-800 dark:border-red-900/50 dark:bg-red-900/10 dark:text-red-300"
          }`}
        >
          {sinPlanificar > 0
            ? `Quedan ${sinPlanificar.toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} € por planificar para llegar al total del proyecto.`
            : `Los hitos suman ${Math.abs(sinPlanificar).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} € por encima del precio total.`}
        </div>
      )}

      {/* Lista de hitos */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Hitos de pago{payments.length > 0 ? ` (${payments.length})` : ""}
          </h3>
        </div>
        {payments.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay hitos. Añade el primero abajo (anticipo, hitos intermedios, entrega final…).
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {payments.map((p) => (
              <li key={p.id} className="px-5 py-3">
                <form action={updateStudioPayment} className="flex flex-wrap items-center gap-3">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <input
                    type="text"
                    name="label"
                    defaultValue={p.label}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0"
                      defaultValue={p.amount}
                      className="block w-28 rounded-lg border border-zinc-300 bg-white py-1 pr-2 pl-6 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-zinc-400">&euro;</span>
                  </div>
                  <input
                    type="date"
                    name="due_date"
                    defaultValue={p.due_date ?? ""}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <select
                    name="status"
                    defaultValue={p.status}
                    className={`rounded-full border-0 px-2 py-1 text-xs font-medium ${PAYMENT_STATUS_COLORS[p.status] ?? PAYMENT_STATUS_COLORS.pendiente}`}
                  >
                    {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
                      <option key={v} value={v}>{l}</option>
                    ))}
                  </select>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Guardar
                  </button>
                </form>
                <form action={deleteStudioPayment} className="mt-1">
                  <input type="hidden" name="id" value={p.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Eliminar hito
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Añadir hito */}
      <form
        action={addStudioPayment}
        className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Añadir hito</h3>
        <input type="hidden" name="studio_project_id" value={projectId} />
        <div className="grid gap-3 sm:grid-cols-[1fr_auto_auto_auto_auto]">
          <input
            type="text"
            name="label"
            required
            placeholder="Anticipo 30%, hito diseño, entrega final..."
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <div className="relative">
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              className="block w-32 rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">&euro;</span>
          </div>
          <input
            type="date"
            name="due_date"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          />
          <select
            name="status"
            defaultValue="pendiente"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Añadir
          </button>
        </div>
      </form>
    </div>
  );
}

type Collaborator = {
  id: string;
  studio_project_id: string;
  email: string;
  name: string | null;
  token: string;
  can_see_brief: boolean;
  can_see_meetings: boolean;
  can_see_payments: boolean;
  can_see_documents: boolean;
  last_viewed_at: string | null;
  created_at: string;
};

function AccesosTab({
  projectId,
  collaborators,
}: {
  projectId: string;
  collaborators: Collaborator[];
}) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-300">
        Cada persona invitada recibe un link único a su portal. Marca abajo qué secciones puede ver. Pueden guardarlo en favoritos del navegador y entrar sin contraseña.
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Colaboradores{collaborators.length > 0 ? ` (${collaborators.length})` : ""}
          </h3>
        </div>
        {collaborators.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay nadie invitado. Añade abajo el primer colaborador.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {collaborators.map((c) => (
              <li key={c.id} className="px-5 py-4">
                <form action={updateStudioCollaboratorAccess} className="space-y-3">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">{c.email}</p>
                      <input
                        type="text"
                        name="name"
                        defaultValue={c.name ?? ""}
                        placeholder="Nombre (opcional)"
                        className="mt-1 block w-full rounded-lg border border-zinc-200 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                      />
                    </div>
                    <div className="text-right text-[11px] text-zinc-500 dark:text-zinc-400">
                      {c.last_viewed_at
                        ? `Visto ${new Date(c.last_viewed_at).toLocaleString("es-ES")}`
                        : "Sin visitas todavía"}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-3 text-xs text-zinc-700 dark:text-zinc-300">
                    <Toggle name="can_see_brief" label="Brief" defaultChecked={c.can_see_brief} />
                    <Toggle name="can_see_payments" label="Pagos" defaultChecked={c.can_see_payments} />
                    <Toggle name="can_see_meetings" label="Reuniones" defaultChecked={c.can_see_meetings} />
                    <Toggle name="can_see_documents" label="Documentos" defaultChecked={c.can_see_documents} />
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <CopyPortalLink token={c.token} />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Guardar
                    </button>
                  </div>
                </form>
                <form action={deleteStudioCollaborator} className="mt-1">
                  <input type="hidden" name="id" value={c.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Quitar acceso
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Añadir */}
      <form
        action={addStudioCollaborator}
        className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Invitar a alguien</h3>
        <input type="hidden" name="studio_project_id" value={projectId} />
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Email *</label>
            <input
              type="email"
              name="email"
              required
              placeholder="cliente@empresa.com"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Nombre</label>
            <input
              type="text"
              name="name"
              placeholder="Founder, abogado, CFO..."
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-3 text-xs text-zinc-700 dark:text-zinc-300">
          <Toggle name="can_see_brief" label="Brief" defaultChecked />
          <Toggle name="can_see_payments" label="Pagos" defaultChecked />
          <Toggle name="can_see_meetings" label="Reuniones" />
          <Toggle name="can_see_documents" label="Documentos" defaultChecked />
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Añadir colaborador
          </button>
        </div>
      </form>
    </div>
  );
}

function Toggle({ name, label, defaultChecked }: { name: string; label: string; defaultChecked?: boolean }) {
  return (
    <label className="inline-flex items-center gap-1.5">
      <input
        type="checkbox"
        name={name}
        defaultChecked={defaultChecked}
        className="h-4 w-4 rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600 dark:bg-zinc-800"
      />
      <span>{label}</span>
    </label>
  );
}

type Meeting = {
  id: string;
  studio_project_id: string;
  meeting_date: string;
  attendees: string[];
  summary: string | null;
  action_items: string | null;
  recording_url: string | null;
  created_at: string;
};

function ReunionesTab({
  projectId,
  meetings,
}: {
  projectId: string;
  meetings: Meeting[];
}) {
  const inputClass =
    "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

  return (
    <div className="space-y-6">
      {/* Lista */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Reuniones{meetings.length > 0 ? ` (${meetings.length})` : ""}
          </h3>
        </div>
        {meetings.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay reuniones registradas. Apunta la primera abajo.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {meetings.map((m) => (
              <li key={m.id} className="px-5 py-4">
                <details className="group">
                  <summary className="flex cursor-pointer items-center justify-between gap-3 list-none">
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-zinc-900 dark:text-white">
                        {formatDateTime(m.meeting_date)}
                      </p>
                      {m.attendees.length > 0 && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                          {m.attendees.join(", ")}
                        </p>
                      )}
                    </div>
                    <svg
                      className="h-4 w-4 shrink-0 text-zinc-400 transition-transform group-open:rotate-180"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                    </svg>
                  </summary>

                  <form action={updateStudioMeeting} className="mt-4 space-y-3">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="studio_project_id" value={projectId} />

                    <div className="grid gap-3 sm:grid-cols-2">
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha y hora</label>
                        <input
                          type="datetime-local"
                          name="meeting_date"
                          defaultValue={toMadridDateTimeInput(m.meeting_date)}
                          required
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                          Asistentes (separados por coma)
                        </label>
                        <input
                          type="text"
                          name="attendees"
                          defaultValue={m.attendees.join(", ")}
                          placeholder="Manu, Isabella, cliente"
                          className={`mt-1 ${inputClass}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Resumen</label>
                      <textarea
                        name="summary"
                        rows={3}
                        defaultValue={m.summary ?? ""}
                        placeholder="Qué se habló, decisiones tomadas..."
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Próximos pasos / acciones
                      </label>
                      <textarea
                        name="action_items"
                        rows={3}
                        defaultValue={m.action_items ?? ""}
                        placeholder="Quién hace qué, fechas..."
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
                        Link de la grabación
                      </label>
                      <input
                        type="url"
                        name="recording_url"
                        defaultValue={m.recording_url ?? ""}
                        placeholder="https://..."
                        className={`mt-1 ${inputClass}`}
                      />
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <button
                        type="submit"
                        className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                      >
                        Guardar cambios
                      </button>
                    </div>
                  </form>

                  <form action={deleteStudioMeeting} className="mt-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="studio_project_id" value={projectId} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    >
                      Eliminar reunión
                    </button>
                  </form>
                </details>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Añadir */}
      <form
        action={addStudioMeeting}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Añadir reunión</h3>
        <input type="hidden" name="studio_project_id" value={projectId} />

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha y hora *</label>
            <input
              type="datetime-local"
              name="meeting_date"
              required
              className={`mt-1 ${inputClass}`}
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
              Asistentes (separados por coma)
            </label>
            <input
              type="text"
              name="attendees"
              placeholder="Manu, Isabella, cliente"
              className={`mt-1 ${inputClass}`}
            />
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Resumen</label>
          <textarea
            name="summary"
            rows={3}
            placeholder="Qué se habló, decisiones tomadas..."
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
            Próximos pasos / acciones
          </label>
          <textarea
            name="action_items"
            rows={3}
            placeholder="Quién hace qué, fechas..."
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Link de la grabación</label>
          <input
            type="url"
            name="recording_url"
            placeholder="https://..."
            className={`mt-1 ${inputClass}`}
          />
        </div>

        <div className="flex justify-end pt-1">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Añadir reunión
          </button>
        </div>
      </form>
    </div>
  );
}
