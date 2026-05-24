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
import { duplicateStudioPaymentNextMonth } from "../proforma-actions";
import PaymentProformaActions from "./payment-proforma-actions";
import {
  addStudioMember,
  updateStudioMemberRole,
  removeStudioMember,
} from "../member-actions";
import {
  addStudioMeeting,
  updateStudioMeeting,
  deleteStudioMeeting,
} from "../meeting-actions";
import {
  addStudioExpense,
  updateStudioExpense,
  deleteStudioExpense,
  addStudioTimeEntry,
  updateStudioTimeEntry,
  deleteStudioTimeEntry,
} from "../cost-actions";
import {
  sendStudioNdaToClient,
  getStudioNdaStatus,
  cancelStudioNda,
} from "../nda-actions";
import {
  sendStudioDevAgreement,
  getStudioDevAgreementStatus,
  cancelStudioDevAgreement,
  updateStudioCommercialTerms,
} from "../dev-agreement-actions";
import { CopyPortalLink } from "./copy-portal-link";
import { NdaDescriptionField } from "./nda-description-field";
import { ProjectDocuments } from "../../projects/[id]/project-documents";
import { formatDateTime, formatDateMedium, toMadridDateTimeInput } from "@/lib/dates";

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

type Tab = "resumen" | "brief" | "pagos" | "documentos" | "reuniones" | "equipo" | "costes";

const HOURLY_RATE_EUR = 20;

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
    tabParam === "brief"
      ? "brief"
      : tabParam === "pagos"
        ? "pagos"
        : tabParam === "documentos"
          ? "documentos"
          : tabParam === "reuniones"
            ? "reuniones"
            : tabParam === "equipo" || tabParam === "accesos"
              ? "equipo"
              : tabParam === "costes"
                ? "costes"
                : "resumen";

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

  const [
    { data: payments },
    { data: collaborators },
    { data: members },
    { data: meetings },
    { data: expenses },
    { data: timeEntries },
  ] = await Promise.all([
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
      .from("studio_project_members")
      .select("id, user_id, role, created_at")
      .eq("studio_project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("studio_meetings")
      .select("*")
      .eq("studio_project_id", id)
      .order("meeting_date", { ascending: false }),
    canDelete
      ? supabase
          .from("studio_expenses")
          .select("*")
          .eq("studio_project_id", id)
          .order("expense_date", { ascending: false })
      : Promise.resolve({ data: null }),
    // Las horas son visibles para los miembros del proyecto también, no
    // solo managers, así que las pedimos siempre. La pestaña Costes filtra
    // qué se renderiza según permisos.
    supabase
      .from("studio_time_entries")
      .select("*")
      .eq("studio_project_id", id)
      .order("work_date", { ascending: false }),
  ]);

  // Si el proyecto tiene miembros configurados, los pickers (PM, asistentes,
  // imputación de horas) se filtran a esa lista. Si no hay ninguno, se muestra
  // a toda la oficina como antes (migración suave).
  const allUsers = activeUsers ?? [];
  const memberRows = members ?? [];
  const memberUserIds = new Set(memberRows.map((m) => m.user_id));
  const baseTeam = memberUserIds.size > 0
    ? allUsers.filter((u) => memberUserIds.has(u.id))
    : allUsers;

  // Costes: los managers ven todo (gastos, horas, margen). Los miembros
  // del proyecto pueden ver/editar horas pero no gastos ni cifras €.
  const isProjectMember = memberUserIds.has(profile.id);
  const canViewCosts = canDelete || isProjectMember;
  // El PM actual debe seguir apareciendo en el dropdown aunque no esté en el equipo
  // (ej. proyectos antiguos donde el PM se fijó antes de configurar miembros).
  const projectTeam = project.project_manager_id && !baseTeam.some((u) => u.id === project.project_manager_id)
    ? [...baseTeam, ...allUsers.filter((u) => u.id === project.project_manager_id)]
    : baseTeam;

  const [ndaStatus, devAgreementStatus] = await Promise.all([
    getStudioNdaStatus(id),
    getStudioDevAgreementStatus(id),
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

      {/* Tabs */}
      <div className="mb-4 border-b border-zinc-200 dark:border-zinc-800">
        <nav className="flex gap-1">
          <TabLink id={project.id} tab="resumen" current={tab} label="Resumen" />
          <TabLink id={project.id} tab="brief" current={tab} label="Brief" />
          <TabLink id={project.id} tab="pagos" current={tab} label="Pagos" />
          <TabLink id={project.id} tab="documentos" current={tab} label="Documentos" />
          <TabLink
            id={project.id}
            tab="reuniones"
            current={tab}
            label={`Reuniones${meetings && meetings.length > 0 ? ` (${meetings.length})` : ""}`}
          />
          {canViewCosts && (
            <TabLink id={project.id} tab="costes" current={tab} label="Costes" />
          )}
          <TabLink
            id={project.id}
            tab="equipo"
            current={tab}
            label={`Equipo${(memberRows.length + (collaborators?.length ?? 0)) > 0 ? ` (${memberRows.length + (collaborators?.length ?? 0)})` : ""}`}
          />
        </nav>
      </div>

      {tab === "resumen" && (
        <ResumenTab
          project={project}
          team={allUsers}
          collaborators={collaborators ?? []}
          meetings={meetings ?? []}
          payments={payments ?? []}
          expenses={expenses ?? []}
          timeEntries={timeEntries ?? []}
          ndaStatus={ndaStatus}
          total={total}
          cobrado={cobrado}
          facturado={facturado}
          canManage={canDelete}
        />
      )}

      {tab === "brief" && (
        <BriefTab
          project={project}
          activeUsers={projectTeam}
          canDelete={canDelete}
        />
      )}

      {tab === "pagos" && (
        <PagosTab
          projectId={project.id}
          payments={payments ?? []}
          total={total}
          planificado={planificado}
          facturado={facturado}
          cobrado={cobrado}
          baseUrl={process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es"}
        />
      )}

      {tab === "documentos" && (
        <div className="space-y-6">
          <NdaSection
            projectId={project.id}
            ndaStatus={ndaStatus}
            canManage={canDelete}
            ndaProjectDescription={project.nda_project_description}
          />
          <DevAgreementSection
            projectId={project.id}
            agreementStatus={devAgreementStatus}
            canManage={canDelete}
            ndaSigned={ndaStatus.status === "signed"}
            ndaProjectDescription={project.nda_project_description}
            terms={{
              workspaceFee: Number(project.dev_agreement_workspace_fee),
              engineeringHours: project.dev_agreement_engineering_hours,
              engineeringRate: Number(project.dev_agreement_engineering_rate),
              printingHours: project.dev_agreement_printing_hours,
              printingRate: Number(project.dev_agreement_printing_rate),
              minimumMonths: project.dev_agreement_minimum_months,
              approvalThreshold: Number(project.dev_agreement_approval_threshold),
            }}
          />
          <ProjectDocuments
            projectId={project.id}
            folderId={project.google_drive_folder_id}
            kind="studio"
          />
        </div>
      )}

      {tab === "reuniones" && (
        <ReunionesTab
          projectId={project.id}
          meetings={meetings ?? []}
          team={projectTeam}
          collaborators={collaborators ?? []}
        />
      )}

      {tab === "costes" && canViewCosts && (
        <CostesTab
          projectId={project.id}
          expenses={expenses ?? []}
          timeEntries={timeEntries ?? []}
          team={projectTeam}
          cobrado={cobrado}
          canFullCosts={canDelete}
          currentUserId={profile.id}
        />
      )}

      {tab === "equipo" && (
        <EquipoTab
          projectId={project.id}
          members={memberRows}
          allUsers={allUsers}
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
  nda_project_description: string | null;
  dev_agreement_workspace_fee: number;
  dev_agreement_engineering_hours: number;
  dev_agreement_engineering_rate: number;
  dev_agreement_printing_hours: number;
  dev_agreement_printing_rate: number;
  dev_agreement_minimum_months: number;
  dev_agreement_approval_threshold: number;
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

        <div className="space-y-4 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">NDA</h3>
          <NdaDescriptionField
            projectId={project.id}
            initialValue={project.nda_project_description ?? ""}
          />
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
  tracking_token: string;
  holded_proforma_id: string | null;
  holded_proforma_doc_number: string | null;
  proforma_sent_at: string | null;
  payment_status: string | null;
};

function PagosTab({
  projectId,
  payments,
  total,
  planificado,
  facturado,
  cobrado,
  baseUrl,
}: {
  projectId: string;
  payments: Payment[];
  total: number;
  planificado: number;
  facturado: number;
  cobrado: number;
  baseUrl: string;
}) {
  const sinPlanificar = total > 0 ? total - planificado : 0;

  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-4">
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
                <PaymentProformaActions
                  paymentId={p.id}
                  hasProforma={Boolean(p.holded_proforma_id)}
                  docNumber={p.holded_proforma_doc_number}
                  proformaSentAt={p.proforma_sent_at}
                  paymentStatus={p.payment_status}
                  trackingUrl={`${baseUrl}/proforma/${p.tracking_token}`}
                  paymentLabel={p.label}
                />
                <div className="mt-1 flex flex-wrap gap-3 text-xs">
                  <form action={duplicateStudioPaymentNextMonth}>
                    <input type="hidden" name="id" value={p.id} />
                    <button
                      type="submit"
                      className="text-zinc-500 hover:text-brand-blue dark:text-zinc-400 dark:hover:text-brand-blue"
                    >
                      Duplicar próximo mes
                    </button>
                  </form>
                  <form action={deleteStudioPayment}>
                    <input type="hidden" name="id" value={p.id} />
                    <input type="hidden" name="studio_project_id" value={projectId} />
                    <button
                      type="submit"
                      className="text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    >
                      Eliminar hito
                    </button>
                  </form>
                </div>
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

type Member = {
  id: string;
  user_id: string;
  role: string | null;
  created_at: string;
};

function EquipoTab({
  projectId,
  members,
  allUsers,
  collaborators,
}: {
  projectId: string;
  members: Member[];
  allUsers: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  collaborators: Collaborator[];
}) {
  const memberByUserId = new Map(members.map((m) => [m.user_id, m]));
  const memberUsers = allUsers.filter((u) => memberByUserId.has(u.id));
  const nonMemberUsers = allUsers.filter((u) => !memberByUserId.has(u.id));

  return (
    <div className="space-y-6">
      {/* Equipo Prototipalo */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Equipo Prototipalo{memberUsers.length > 0 ? ` (${memberUsers.length})` : ""}
          </h3>
          <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">
            Quién de la oficina está involucrado. Filtra los selectores de PM, asistentes a reuniones e imputación de horas. Si no añades a nadie, los selectores muestran a toda la oficina.
          </p>
        </div>

        {memberUsers.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay miembros internos. Añade abajo a quién está involucrado.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {memberUsers.map((u) => {
              const m = memberByUserId.get(u.id)!;
              return (
                <li key={u.id} className="flex flex-wrap items-center gap-3 px-5 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
                      {u.nickname || u.full_name || u.email.split("@")[0]}
                    </p>
                    <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{u.email}</p>
                  </div>
                  <form action={updateStudioMemberRole} className="flex items-center gap-2">
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="studio_project_id" value={projectId} />
                    <input
                      type="text"
                      name="role"
                      defaultValue={m.role ?? ""}
                      placeholder="Rol (opcional)"
                      className="w-40 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    />
                    <button
                      type="submit"
                      className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                    >
                      Guardar
                    </button>
                  </form>
                  <form action={removeStudioMember}>
                    <input type="hidden" name="id" value={m.id} />
                    <input type="hidden" name="studio_project_id" value={projectId} />
                    <button
                      type="submit"
                      className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                    >
                      Quitar
                    </button>
                  </form>
                </li>
              );
            })}
          </ul>
        )}

        {nonMemberUsers.length > 0 && (
          <div className="border-t border-zinc-200 px-5 py-4 dark:border-zinc-800">
            <p className="mb-2 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Añadir miembro
            </p>
            <div className="flex flex-wrap gap-2">
              {nonMemberUsers.map((u) => (
                <form key={u.id} action={addStudioMember}>
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <input type="hidden" name="user_id" value={u.id} />
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1 rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 hover:border-brand hover:bg-brand/10 hover:text-brand-dark dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-brand/20 dark:hover:text-white"
                  >
                    <span>+</span>
                    {u.nickname || u.full_name || u.email.split("@")[0]}
                  </button>
                </form>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Cliente / colaboradores externos */}
      <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-xs text-blue-800 dark:border-blue-900/50 dark:bg-blue-900/10 dark:text-blue-300">
        Cada persona invitada recibe un link único a su portal. Marca abajo qué secciones puede ver. Pueden guardarlo en favoritos del navegador y entrar sin contraseña.
      </div>

      {/* Lista */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Cliente / colaboradores externos{collaborators.length > 0 ? ` (${collaborators.length})` : ""}
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

function teamLabel(u: { full_name: string | null; nickname: string | null; email: string }): string {
  return u.nickname || u.full_name || u.email.split("@")[0];
}

function collaboratorLabel(c: { name: string | null; email: string }): string {
  return c.name || c.email;
}

function AttendeesPicker({
  team,
  collaborators,
  defaultAttendees = [],
}: {
  team: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  collaborators: Collaborator[];
  defaultAttendees?: string[];
}) {
  const teamLabels = team.map(teamLabel);
  const collabLabels = collaborators.map(collaboratorLabel);
  const known = new Set([...teamLabels, ...collabLabels]);

  const selected = new Set<string>();
  const extras: string[] = [];
  for (const a of defaultAttendees) {
    if (known.has(a)) selected.add(a);
    else extras.push(a);
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
          Equipo
        </p>
        {team.length === 0 ? (
          <p className="text-xs text-zinc-400">No hay miembros activos.</p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {team.map((u) => {
              const label = teamLabel(u);
              return (
                <label
                  key={u.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:text-brand-dark dark:border-zinc-700 dark:text-zinc-300 dark:has-[:checked]:bg-brand/20 dark:has-[:checked]:text-white"
                >
                  <input
                    type="checkbox"
                    name="attendees"
                    value={label}
                    defaultChecked={selected.has(label)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        )}
      </div>

      {collaborators.length > 0 && (
        <div>
          <p className="mb-1.5 text-xs font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Cliente / colaboradores
          </p>
          <div className="flex flex-wrap gap-2">
            {collaborators.map((c) => {
              const label = collaboratorLabel(c);
              return (
                <label
                  key={c.id}
                  className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-zinc-300 px-2.5 py-1 text-xs text-zinc-700 has-[:checked]:border-brand has-[:checked]:bg-brand/10 has-[:checked]:text-brand-dark dark:border-zinc-700 dark:text-zinc-300 dark:has-[:checked]:bg-brand/20 dark:has-[:checked]:text-white"
                >
                  <input
                    type="checkbox"
                    name="attendees"
                    value={label}
                    defaultChecked={selected.has(label)}
                    className="h-3.5 w-3.5 rounded border-zinc-300 text-brand focus:ring-brand-blue dark:border-zinc-600 dark:bg-zinc-800"
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">
          Otros (separados por coma)
        </label>
        <input
          type="text"
          name="attendees_extra"
          defaultValue={extras.join(", ")}
          placeholder="Consultor externo, abogado invitado…"
          className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
      </div>
    </div>
  );
}

function ReunionesTab({
  projectId,
  meetings,
  team,
  collaborators,
}: {
  projectId: string;
  meetings: Meeting[];
  team: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  collaborators: Collaborator[];
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

                    <div>
                      <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha y hora</label>
                      <input
                        type="datetime-local"
                        name="meeting_date"
                        defaultValue={toMadridDateTimeInput(m.meeting_date)}
                        required
                        className={`mt-1 ${inputClass} sm:max-w-xs`}
                      />
                    </div>

                    <div>
                      <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Asistentes</p>
                      <AttendeesPicker
                        team={team}
                        collaborators={collaborators}
                        defaultAttendees={m.attendees}
                      />
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

        <div>
          <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400">Fecha y hora *</label>
          <input
            type="datetime-local"
            name="meeting_date"
            required
            className={`mt-1 ${inputClass} sm:max-w-xs`}
          />
        </div>

        <div>
          <p className="mb-2 text-xs font-medium text-zinc-600 dark:text-zinc-400">Asistentes</p>
          <AttendeesPicker team={team} collaborators={collaborators} />
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

type Expense = {
  id: string;
  studio_project_id: string;
  concept: string;
  amount: number;
  expense_date: string;
  category: string | null;
  supplier: string | null;
  notes: string | null;
  created_at: string;
};

type TimeEntryKind = "engineering" | "print";

type TimeEntry = {
  id: string;
  studio_project_id: string;
  user_id: string | null;
  user_label: string | null;
  work_date: string;
  hours: number;
  kind: string;
  description: string | null;
  created_at: string;
};

function normalizeKind(k: string | null | undefined): TimeEntryKind {
  return k === "print" ? "print" : "engineering";
}

function CostesTab({
  projectId,
  expenses,
  timeEntries,
  team,
  cobrado,
  canFullCosts,
  currentUserId,
}: {
  projectId: string;
  expenses: Expense[];
  timeEntries: TimeEntry[];
  team: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  cobrado: number;
  canFullCosts: boolean;
  currentUserId: string;
}) {
  const inputClass =
    "block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500";

  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const engineeringHours = timeEntries
    .filter((t) => normalizeKind(t.kind) === "engineering")
    .reduce((acc, t) => acc + Number(t.hours), 0);
  const printHours = timeEntries
    .filter((t) => normalizeKind(t.kind) === "print")
    .reduce((acc, t) => acc + Number(t.hours), 0);
  const totalHours = engineeringHours + printHours;
  const horasCoste = engineeringHours * HOURLY_RATE_EUR;
  const margen = cobrado - totalExpenses - horasCoste;
  const margenPct = cobrado > 0 ? Math.round((margen / cobrado) * 100) : null;
  const formatHours = (h: number) =>
    h.toLocaleString("es-ES", { maximumFractionDigits: 1 });

  const todayIso = new Date().toISOString().slice(0, 10);

  return (
    <div className="space-y-6">
      {/* Resumen interno */}
      <div className={`grid gap-3 ${canFullCosts ? "sm:grid-cols-2 lg:grid-cols-5" : "sm:grid-cols-2"}`}>
        {canFullCosts && (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Cobrado</p>
            <p className="mt-1 text-lg font-bold text-green-600 dark:text-green-400">{formatEur(cobrado)}</p>
          </div>
        )}
        {canFullCosts && (
          <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">Gastos</p>
            <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">{formatEur(totalExpenses)}</p>
          </div>
        )}
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Ingeniería
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
            {formatHours(engineeringHours)}h
            {canFullCosts && (
              <span className="ml-2 text-xs font-normal text-zinc-500">{formatEur(horasCoste)}</span>
            )}
          </p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-3 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
            Impresión
          </p>
          <p className="mt-1 text-lg font-bold text-zinc-900 dark:text-white">
            {formatHours(printHours)}h
          </p>
        </div>
        {canFullCosts && (
          <div
            className={`rounded-xl border p-3 ${
              margen >= 0
                ? "border-green-200 bg-green-50 dark:border-green-900/50 dark:bg-green-900/10"
                : "border-red-200 bg-red-50 dark:border-red-900/50 dark:bg-red-900/10"
            }`}
          >
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-600 dark:text-zinc-300">Margen</p>
            <p className={`mt-1 text-lg font-bold ${margen >= 0 ? "text-green-700 dark:text-green-300" : "text-red-700 dark:text-red-300"}`}>
              {formatEur(margen)}
              {margenPct !== null && (
                <span className="ml-2 text-xs font-normal opacity-80">{margenPct}%</span>
              )}
            </p>
          </div>
        )}
      </div>

      {/* Gastos (solo managers) */}
      {canFullCosts && (
      <>
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Gastos directos{expenses.length > 0 ? ` (${expenses.length})` : ""}
          </h3>
        </div>
        {expenses.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay gastos imputados.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {expenses.map((e) => (
              <li key={e.id} className="px-5 py-3">
                <form action={updateStudioExpense} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <input
                    type="date"
                    name="expense_date"
                    defaultValue={e.expense_date}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <input
                    type="text"
                    name="concept"
                    defaultValue={e.concept}
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <input
                    type="text"
                    name="supplier"
                    defaultValue={e.supplier ?? ""}
                    placeholder="Proveedor"
                    className="w-32 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  />
                  <div className="relative">
                    <input
                      type="number"
                      name="amount"
                      step="0.01"
                      min="0"
                      defaultValue={e.amount}
                      className="block w-24 rounded-lg border border-zinc-300 bg-white py-1 pr-2 pl-6 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                    />
                    <span className="pointer-events-none absolute top-1/2 left-2 -translate-y-1/2 text-xs text-zinc-400">&euro;</span>
                  </div>
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Guardar
                  </button>
                </form>
                <form action={deleteStudioExpense} className="mt-1">
                  <input type="hidden" name="id" value={e.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
            ))}
          </ul>
        )}
      </div>

      <form
        action={addStudioExpense}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Añadir gasto</h3>
        <input type="hidden" name="studio_project_id" value={projectId} />
        <div className="grid gap-3 sm:grid-cols-[auto_1fr_auto_auto_auto]">
          <input
            type="date"
            name="expense_date"
            defaultValue={todayIso}
            className={inputClass}
          />
          <input
            type="text"
            name="concept"
            required
            placeholder="Concepto (Patente, materiales, abogado...)"
            className={inputClass}
          />
          <input
            type="text"
            name="supplier"
            placeholder="Proveedor"
            className={`${inputClass} sm:w-40`}
          />
          <div className="relative">
            <input
              type="number"
              name="amount"
              step="0.01"
              min="0"
              required
              placeholder="0.00"
              className={`block w-32 rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white`}
            />
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">&euro;</span>
          </div>
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Añadir
          </button>
        </div>
      </form>
      </>
      )}

      {/* Horas imputadas */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Horas imputadas
            {timeEntries.length > 0 && (
              <span className="ml-2 text-xs font-normal text-zinc-500 dark:text-zinc-400">
                {formatHours(totalHours)}h
                <span className="mx-1">·</span>
                ing {formatHours(engineeringHours)}h
                <span className="mx-1">·</span>
                impr {formatHours(printHours)}h
              </span>
            )}
          </h3>
        </div>
        {timeEntries.length === 0 ? (
          <p className="px-5 py-6 text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay horas imputadas.
          </p>
        ) : (
          <ul className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {timeEntries.map((t) => {
              const isOwner = t.user_id === currentUserId;
              const canEdit = canFullCosts || isOwner;
              if (!canEdit) {
                return (
                  <li key={t.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-sm">
                    <span className="text-xs text-zinc-500 dark:text-zinc-400">{t.work_date}</span>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                      normalizeKind(t.kind) === "print"
                        ? "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400"
                        : "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                    }`}>
                      {normalizeKind(t.kind) === "print" ? "Impresión" : "Ingeniería"}
                    </span>
                    <span className="font-medium text-zinc-700 dark:text-zinc-300">
                      {t.user_label ?? "Sin asignar"}
                    </span>
                    <span className="font-semibold text-zinc-900 dark:text-white">
                      {Number(t.hours).toLocaleString("es-ES", { maximumFractionDigits: 2 })}h
                    </span>
                    {t.description && (
                      <span className="min-w-0 flex-1 truncate text-zinc-500 dark:text-zinc-400">
                        {t.description}
                      </span>
                    )}
                  </li>
                );
              }
              return (
              <li key={t.id} className="px-5 py-3">
                <form action={updateStudioTimeEntry} className="flex flex-wrap items-center gap-2">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <input
                    type="date"
                    name="work_date"
                    defaultValue={t.work_date}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <select
                    name="kind"
                    defaultValue={normalizeKind(t.kind)}
                    className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                  >
                    <option value="engineering">Ingeniería</option>
                    <option value="print">Impresión</option>
                  </select>
                  {canFullCosts ? (
                    <select
                      name="user_id"
                      defaultValue={t.user_id ?? ""}
                      className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-700 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-300"
                    >
                      <option value="">{t.user_label ?? "Sin asignar"}</option>
                      {team.map((u) => (
                        <option key={u.id} value={u.id}>
                          {u.nickname || u.full_name || u.email.split("@")[0]}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <>
                      <input type="hidden" name="user_id" value={t.user_id ?? ""} />
                      <span className="rounded-lg bg-zinc-100 px-2 py-1 text-xs text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
                        {t.user_label ?? "Yo"}
                      </span>
                    </>
                  )}
                  <input
                    type="number"
                    name="hours"
                    step="0.25"
                    min="0.25"
                    defaultValue={t.hours}
                    className="w-20 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <span className="text-xs text-zinc-400">h</span>
                  <input
                    type="text"
                    name="description"
                    defaultValue={t.description ?? ""}
                    placeholder="¿Qué hiciste?"
                    className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
                  />
                  <button
                    type="submit"
                    className="rounded-lg border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                  >
                    Guardar
                  </button>
                </form>
                <form action={deleteStudioTimeEntry} className="mt-1">
                  <input type="hidden" name="id" value={t.id} />
                  <input type="hidden" name="studio_project_id" value={projectId} />
                  <button
                    type="submit"
                    className="text-xs text-zinc-400 hover:text-red-600 dark:text-zinc-500 dark:hover:text-red-400"
                  >
                    Eliminar
                  </button>
                </form>
              </li>
              );
            })}
          </ul>
        )}
      </div>

      <form
        action={addStudioTimeEntry}
        className="space-y-3 rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">Imputar horas</h3>
        <input type="hidden" name="studio_project_id" value={projectId} />
        {!canFullCosts && (
          <input type="hidden" name="user_id" value={currentUserId} />
        )}
        <div className={`grid gap-3 ${canFullCosts ? "sm:grid-cols-[auto_auto_auto_auto_1fr_auto]" : "sm:grid-cols-[auto_auto_auto_1fr_auto]"}`}>
          <input
            type="date"
            name="work_date"
            defaultValue={todayIso}
            className={inputClass}
          />
          <select
            name="kind"
            defaultValue="engineering"
            className={`${inputClass} sm:w-32`}
          >
            <option value="engineering">Ingeniería</option>
            <option value="print">Impresión</option>
          </select>
          {canFullCosts && (
            <select
              name="user_id"
              required
              defaultValue=""
              className={`${inputClass} sm:w-40`}
            >
              <option value="" disabled>Quién</option>
              {team.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nickname || u.full_name || u.email.split("@")[0]}
                </option>
              ))}
            </select>
          )}
          <input
            type="number"
            name="hours"
            step="0.25"
            min="0.25"
            required
            placeholder="2.5"
            className={`${inputClass} sm:w-24`}
          />
          <input
            type="text"
            name="description"
            placeholder="¿Qué hiciste? (opcional)"
            className={inputClass}
          />
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Imputar
          </button>
        </div>
      </form>
    </div>
  );
}

type NdaStatus = Awaited<ReturnType<typeof getStudioNdaStatus>>;

function NdaSection({
  projectId,
  ndaStatus,
  canManage,
  ndaProjectDescription,
}: {
  projectId: string;
  ndaStatus: NdaStatus;
  canManage: boolean;
  ndaProjectDescription: string | null;
}) {
  const hasDescription = !!ndaProjectDescription?.trim();
  if (ndaStatus.status === "signed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                NDA firmado
              </h3>
            </div>
            <p className="mt-1 text-xs text-green-700/80 dark:text-green-400/80">
              {ndaStatus.signer_name && <>{ndaStatus.signer_name} — </>}
              {ndaStatus.signed_at && formatDateMedium(ndaStatus.signed_at)}
            </p>
          </div>
          {canManage && ndaStatus.id && (
            <a
              href={`/api/admin/regen-nda?id=${ndaStatus.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:bg-zinc-900 dark:text-green-300 dark:hover:bg-zinc-800"
            >
              Descargar PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  if (ndaStatus.status === "pending") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                NDA pendiente de firma
              </h3>
            </div>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
              Enviado{ndaStatus.signer_email ? ` a ${ndaStatus.signer_email}` : ""}. Esperando firma del cliente.
            </p>
          </div>
          {canManage && ndaStatus.id && (
            <form action={cancelStudioNda} className="shrink-0">
              <input type="hidden" name="studio_project_id" value={projectId} />
              <input type="hidden" name="nda_id" value={ndaStatus.id} />
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-zinc-800"
              >
                Cancelar y reenviar
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // status === "none"
  if (!canManage) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Aún no se ha enviado NDA al cliente.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Acuerdo de confidencialidad
          </h3>
          <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
            Manda el NDA al cliente antes de compartir info sensible (patentes, datos del cliente, etc.).
          </p>
          {!hasDescription && (
            <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
              Falta la descripción del proyecto.{" "}
              <Link
                href={`/dashboard/studio/${projectId}?tab=brief`}
                className="underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
              >
                Rellénala en el Brief
              </Link>{" "}
              para poder enviar el NDA.
            </p>
          )}
        </div>
        <form action={sendStudioNdaToClient} className="shrink-0">
          <input type="hidden" name="studio_project_id" value={projectId} />
          <button
            type="submit"
            disabled={!hasDescription}
            className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
          >
            Enviar NDA al cliente
          </button>
        </form>
      </div>
    </div>
  );
}

type DevAgreementStatus = Awaited<ReturnType<typeof getStudioDevAgreementStatus>>;

interface CommercialTerms {
  workspaceFee: number;
  engineeringHours: number;
  engineeringRate: number;
  printingHours: number;
  printingRate: number;
  minimumMonths: number;
  approvalThreshold: number;
}

function DevAgreementSection({
  projectId,
  agreementStatus,
  canManage,
  ndaSigned,
  ndaProjectDescription,
  terms,
}: {
  projectId: string;
  agreementStatus: DevAgreementStatus;
  canManage: boolean;
  ndaSigned: boolean;
  ndaProjectDescription: string | null;
  terms: CommercialTerms;
}) {
  const hasDescription = !!ndaProjectDescription?.trim();
  const canSend = ndaSigned && hasDescription;

  if (agreementStatus.status === "signed") {
    return (
      <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-900/50 dark:bg-green-900/10">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
              <h3 className="text-sm font-semibold text-green-700 dark:text-green-400">
                Contrato de desarrollo firmado
              </h3>
              {agreementStatus.language && (
                <span className="rounded-full border border-green-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-green-700 dark:border-green-800 dark:bg-zinc-900 dark:text-green-300">
                  {agreementStatus.language}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-green-700/80 dark:text-green-400/80">
              {agreementStatus.signer_name && <>{agreementStatus.signer_name} — </>}
              {agreementStatus.signed_at && formatDateMedium(agreementStatus.signed_at)}
            </p>
          </div>
          {canManage && agreementStatus.id && (
            <a
              href={`/api/admin/regen-contract?id=${agreementStatus.id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="shrink-0 rounded-lg border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 dark:border-green-800 dark:bg-zinc-900 dark:text-green-300 dark:hover:bg-zinc-800"
            >
              Descargar PDF
            </a>
          )}
        </div>
      </div>
    );
  }

  if (agreementStatus.status === "pending") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-900/50 dark:bg-amber-900/10">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <h3 className="text-sm font-semibold text-amber-700 dark:text-amber-400">
                Contrato pendiente de firma
              </h3>
              {agreementStatus.language && (
                <span className="rounded-full border border-amber-300 bg-white px-2 py-0.5 text-[10px] font-medium uppercase text-amber-700 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-300">
                  {agreementStatus.language}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-amber-700/80 dark:text-amber-400/80">
              Enviado{agreementStatus.signer_email ? ` a ${agreementStatus.signer_email}` : ""}. Esperando firma del cliente.
            </p>
          </div>
          {canManage && agreementStatus.id && (
            <form action={cancelStudioDevAgreement} className="shrink-0">
              <input type="hidden" name="studio_project_id" value={projectId} />
              <input type="hidden" name="agreement_id" value={agreementStatus.id} />
              <button
                type="submit"
                className="rounded-lg border border-amber-300 bg-white px-3 py-1.5 text-xs font-medium text-amber-700 hover:bg-amber-50 dark:border-amber-800 dark:bg-zinc-900 dark:text-amber-300 dark:hover:bg-zinc-800"
              >
                Cancelar y reenviar
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // status === "none"
  if (!canManage) {
    return (
      <div className="rounded-xl border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-500 dark:border-zinc-800 dark:bg-zinc-900/50 dark:text-zinc-400">
        Aún no se ha enviado contrato de desarrollo al cliente.
      </div>
    );
  }

  const monthlyMin = terms.workspaceFee
    + terms.engineeringHours * terms.engineeringRate
    + terms.printingHours * terms.printingRate;

  return (
    <div className="space-y-4 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div>
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
          Contrato de desarrollo y colaboración
        </h3>
        <p className="mt-1 text-xs text-zinc-500 dark:text-zinc-400">
          Manda el contrato al cliente para formalizar tarifas, IP y duración mínima. Los términos se pueden ajustar abajo antes de enviar.
        </p>
        {!ndaSigned && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Necesitas un NDA firmado antes de poder enviar el contrato.
          </p>
        )}
        {ndaSigned && !hasDescription && (
          <p className="mt-2 text-xs text-amber-700 dark:text-amber-400">
            Falta la descripción del proyecto.{" "}
            <Link
              href={`/dashboard/studio/${projectId}?tab=brief`}
              className="underline underline-offset-2 hover:text-amber-800 dark:hover:text-amber-300"
            >
              Rellénala en el Brief
            </Link>{" "}
            para poder enviar el contrato.
          </p>
        )}
      </div>

      <details className="rounded-lg border border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900/50">
        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-zinc-600 dark:text-zinc-300">
          Términos económicos del contrato
        </summary>
        <form action={updateStudioCommercialTerms} className="space-y-3 px-3 pb-3 pt-1">
          <input type="hidden" name="studio_project_id" value={projectId} />
          <div className="grid gap-3 sm:grid-cols-2">
            <NumberField
              label="Cuota de espacio (€/mes)"
              name="workspace_fee"
              defaultValue={terms.workspaceFee}
              step="0.01"
            />
            <NumberField
              label="Período mínimo (meses)"
              name="minimum_months"
              defaultValue={terms.minimumMonths}
              step="1"
            />
            <NumberField
              label="Horas ingeniería / mes"
              name="engineering_hours"
              defaultValue={terms.engineeringHours}
              step="1"
            />
            <NumberField
              label="Tarifa ingeniería (€/h)"
              name="engineering_rate"
              defaultValue={terms.engineeringRate}
              step="0.01"
            />
            <NumberField
              label="Horas impresión / bolsa"
              name="printing_hours"
              defaultValue={terms.printingHours}
              step="1"
            />
            <NumberField
              label="Tarifa impresión (€/h)"
              name="printing_rate"
              defaultValue={terms.printingRate}
              step="0.01"
            />
            <NumberField
              label="Umbral aprobación previa (€)"
              name="approval_threshold"
              defaultValue={terms.approvalThreshold}
              step="0.01"
            />
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400">
            Cuota mensual mínima: {formatEur(monthlyMin)} (IVA excluido).
          </p>
          <button
            type="submit"
            className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-200 dark:hover:bg-zinc-800"
          >
            Guardar términos
          </button>
        </form>
      </details>

      <form action={sendStudioDevAgreement} className="flex flex-wrap items-center gap-2">
        <input type="hidden" name="studio_project_id" value={projectId} />
        <label className="flex items-center gap-2 text-xs text-zinc-600 dark:text-zinc-300">
          Idioma
          <select
            name="language"
            defaultValue="en"
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="en">English</option>
            <option value="es">Español</option>
          </select>
        </label>
        <button
          type="submit"
          disabled={!canSend}
          className="rounded-lg bg-brand px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none disabled:cursor-not-allowed disabled:bg-zinc-300 disabled:hover:bg-zinc-300 dark:disabled:bg-zinc-700 dark:disabled:hover:bg-zinc-700 dark:focus:ring-offset-zinc-900"
        >
          Enviar contrato al cliente
        </button>
      </form>
    </div>
  );
}

function NumberField({
  label,
  name,
  defaultValue,
  step,
}: {
  label: string;
  name: string;
  defaultValue: number;
  step: string;
}) {
  return (
    <label className="block text-xs">
      <span className="block text-zinc-600 dark:text-zinc-400">{label}</span>
      <input
        type="number"
        name={name}
        defaultValue={defaultValue}
        step={step}
        min="0"
        className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
      />
    </label>
  );
}

function ResumenTab({
  project,
  team,
  collaborators,
  meetings,
  payments,
  expenses,
  timeEntries,
  ndaStatus,
  total,
  cobrado,
  facturado,
  canManage,
}: {
  project: StudioProject;
  team: { id: string; full_name: string | null; nickname: string | null; email: string }[];
  collaborators: Collaborator[];
  meetings: Meeting[];
  payments: Payment[];
  expenses: Expense[];
  timeEntries: TimeEntry[];
  ndaStatus: NdaStatus;
  total: number;
  cobrado: number;
  facturado: number;
  canManage: boolean;
}) {
  // Equipo: PM + miembros con horas imputadas
  const pm = project.project_manager_id
    ? team.find((u) => u.id === project.project_manager_id)
    : null;
  const teamLabelOf = (u: { full_name: string | null; nickname: string | null; email: string }) =>
    u.nickname || u.full_name || u.email.split("@")[0];

  const hoursByUserId = new Map<string, number>();
  for (const t of timeEntries) {
    if (!t.user_id) continue;
    hoursByUserId.set(t.user_id, (hoursByUserId.get(t.user_id) ?? 0) + Number(t.hours));
  }
  const contributorsRaw = team.filter(
    (u) => hoursByUserId.has(u.id) && u.id !== project.project_manager_id,
  );

  // Reuniones: meetings vienen ordenadas desc por meeting_date
  const now = Date.now();
  const upcomingMeetings = meetings
    .filter((m) => new Date(m.meeting_date).getTime() > now)
    .reverse(); // ascendente: la más cercana primero
  const pastMeetings = meetings.filter((m) => new Date(m.meeting_date).getTime() <= now);
  const nextMeeting = upcomingMeetings[0] ?? null;
  const lastMeeting = pastMeetings[0] ?? null;

  // Pagos
  const pendiente = payments
    .filter((p) => p.status === "pendiente" || p.status === "facturado")
    .reduce((acc, p) => acc + Number(p.amount), 0);
  const nextPayment = payments.find(
    (p) => p.status === "pendiente" || p.status === "facturado",
  );

  // Costes (manager only)
  const totalExpenses = expenses.reduce((acc, e) => acc + Number(e.amount), 0);
  const totalHours = timeEntries.reduce((acc, t) => acc + Number(t.hours), 0);
  const horasCoste = totalHours * HOURLY_RATE_EUR;
  const margen = cobrado - totalExpenses - horasCoste;

  // NDA badge
  const ndaBadge =
    ndaStatus.status === "signed"
      ? { label: "Firmado", color: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" }
      : ndaStatus.status === "pending"
        ? { label: "Pendiente", color: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" }
        : { label: "Sin enviar", color: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400" };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Equipo */}
      <ResumenCard title="Equipo" linkHref={`/dashboard/studio/${project.id}?tab=equipo`} linkLabel="Gestionar equipo">
        <div className="space-y-3">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Project Manager
            </p>
            <p className="mt-0.5 text-sm text-zinc-900 dark:text-white">
              {pm ? teamLabelOf(pm) : <span className="text-zinc-400">Sin asignar</span>}
            </p>
          </div>

          {canManage && contributorsRaw.length > 0 && (
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Equipo Prototipalo ({totalHours.toLocaleString("es-ES", { maximumFractionDigits: 1 })}h totales)
              </p>
              <ul className="mt-1 space-y-1 text-sm text-zinc-700 dark:text-zinc-300">
                {contributorsRaw
                  .sort((a, b) => (hoursByUserId.get(b.id) ?? 0) - (hoursByUserId.get(a.id) ?? 0))
                  .map((u) => (
                    <li key={u.id} className="flex items-center justify-between">
                      <span>{teamLabelOf(u)}</span>
                      <span className="text-xs text-zinc-500 dark:text-zinc-400">
                        {(hoursByUserId.get(u.id) ?? 0).toLocaleString("es-ES", { maximumFractionDigits: 1 })}h
                      </span>
                    </li>
                  ))}
              </ul>
            </div>
          )}

          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
              Cliente / colaboradores
            </p>
            {collaborators.length === 0 ? (
              <p className="mt-0.5 text-sm text-zinc-400">Aún no hay nadie invitado al portal.</p>
            ) : (
              <ul className="mt-1 space-y-0.5 text-sm text-zinc-700 dark:text-zinc-300">
                {collaborators.map((c) => (
                  <li key={c.id} className="truncate">
                    {c.name || c.email}
                    {c.last_viewed_at && (
                      <span className="ml-2 text-[11px] text-zinc-400">
                        · visitado {formatDateMedium(c.last_viewed_at)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </ResumenCard>

      {/* Reuniones */}
      <ResumenCard
        title={`Reuniones${meetings.length > 0 ? ` (${meetings.length})` : ""}`}
        linkHref={`/dashboard/studio/${project.id}?tab=reuniones`}
        linkLabel={meetings.length > 0 ? "Ver todas" : "Apuntar la primera"}
      >
        {meetings.length === 0 ? (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay reuniones registradas.
          </p>
        ) : (
          <div className="space-y-3">
            {nextMeeting && (
              <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 dark:border-blue-900/50 dark:bg-blue-900/10">
                <p className="text-[11px] font-medium uppercase tracking-wide text-blue-700 dark:text-blue-400">
                  Próxima
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  {formatDateTime(nextMeeting.meeting_date)}
                </p>
                {nextMeeting.attendees.length > 0 && (
                  <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">
                    {nextMeeting.attendees.join(", ")}
                  </p>
                )}
              </div>
            )}

            {lastMeeting && (
              <div>
                <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                  Última
                </p>
                <p className="mt-1 text-sm font-medium text-zinc-900 dark:text-white">
                  {formatDateTime(lastMeeting.meeting_date)}
                </p>
                {lastMeeting.summary && (
                  <p className="mt-1 line-clamp-3 text-xs text-zinc-600 dark:text-zinc-400">
                    {lastMeeting.summary}
                  </p>
                )}
              </div>
            )}
          </div>
        )}
      </ResumenCard>

      {/* NDA */}
      <ResumenCard
        title="NDA"
        linkHref={`/dashboard/studio/${project.id}?tab=documentos`}
        linkLabel="Gestionar"
      >
        <div className="flex flex-wrap items-center gap-2">
          <span className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${ndaBadge.color}`}>
            {ndaBadge.label}
          </span>
          {ndaStatus.status === "signed" && (
            <span className="text-xs text-zinc-500 dark:text-zinc-400">
              {ndaStatus.signer_name && <>{ndaStatus.signer_name} · </>}
              {ndaStatus.signed_at && formatDateMedium(ndaStatus.signed_at)}
            </span>
          )}
          {ndaStatus.status === "pending" && ndaStatus.signer_email && (
            <span className="truncate text-xs text-zinc-500 dark:text-zinc-400">
              enviado a {ndaStatus.signer_email}
            </span>
          )}
        </div>
      </ResumenCard>

      {/* Documentos */}
      <ResumenCard
        title="Documentos"
        linkHref={`/dashboard/studio/${project.id}?tab=documentos`}
        linkLabel={project.google_drive_folder_id ? "Ver en Drive" : "Crear carpeta"}
      >
        {project.google_drive_folder_id ? (
          <p className="text-sm text-zinc-600 dark:text-zinc-300">
            Drive vinculado.{" "}
            <a
              href={`https://drive.google.com/drive/folders/${project.google_drive_folder_id}`}
              target="_blank"
              rel="noopener noreferrer"
              className="text-brand-blue hover:underline"
            >
              Abrir carpeta
            </a>
          </p>
        ) : (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay carpeta de Drive para este proyecto.
          </p>
        )}
      </ResumenCard>

      {/* Estado financiero (solo manager) */}
      {canManage && (
        <ResumenCard
          title="Finanzas (interno)"
          className="md:col-span-2"
          linkHref={`/dashboard/studio/${project.id}?tab=costes`}
          linkLabel="Ver costes y margen"
        >
          <div className="grid gap-3 sm:grid-cols-4">
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Total proyecto
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                {formatEur(total)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Cobrado
              </p>
              <p className="mt-1 text-sm font-bold text-green-600 dark:text-green-400">
                {formatEur(cobrado)}
              </p>
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Pendiente
              </p>
              <p className="mt-1 text-sm font-bold text-zinc-900 dark:text-white">
                {formatEur(pendiente)}
              </p>
              {facturado > 0 && (
                <p className="mt-0.5 text-[11px] text-blue-600 dark:text-blue-400">
                  {formatEur(facturado)} facturado
                </p>
              )}
            </div>
            <div>
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Margen estimado
              </p>
              <p
                className={`mt-1 text-sm font-bold ${
                  margen >= 0
                    ? "text-green-700 dark:text-green-300"
                    : "text-red-700 dark:text-red-300"
                }`}
              >
                {formatEur(margen)}
              </p>
              <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                cobrado − gastos − {totalHours.toLocaleString("es-ES", { maximumFractionDigits: 1 })}h × {HOURLY_RATE_EUR}€
              </p>
            </div>
          </div>

          {nextPayment && (
            <div className="mt-4 rounded-lg border border-zinc-200 bg-zinc-50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
              <p className="text-[11px] font-medium uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                Próximo hito
              </p>
              <div className="mt-1 flex items-center justify-between gap-3">
                <span className="truncate text-sm text-zinc-900 dark:text-white">{nextPayment.label}</span>
                <span className="shrink-0 text-sm font-semibold text-zinc-900 dark:text-white">
                  {formatEur(Number(nextPayment.amount))}
                </span>
              </div>
              {nextPayment.due_date && (
                <p className="mt-0.5 text-[11px] text-zinc-500 dark:text-zinc-400">
                  vence {formatDateMedium(nextPayment.due_date)}
                </p>
              )}
            </div>
          )}
        </ResumenCard>
      )}
    </div>
  );
}

function ResumenCard({
  title,
  children,
  linkHref,
  linkLabel,
  className,
}: {
  title: string;
  children: React.ReactNode;
  linkHref?: string;
  linkLabel?: string;
  className?: string;
}) {
  return (
    <div
      className={`rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900 ${className ?? ""}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">{title}</h3>
        {linkHref && linkLabel && (
          <Link
            href={linkHref}
            className="text-xs text-brand-blue hover:underline"
          >
            {linkLabel}
          </Link>
        )}
      </div>
      {children}
    </div>
  );
}
