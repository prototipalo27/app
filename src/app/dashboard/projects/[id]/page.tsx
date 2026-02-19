import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { updateProjectStatus, deleteProject, updateProjectDeadline, updateProjectPriority } from "../actions";
import PrioritySelector from "./priority-selector";
import PortalToggles from "./portal-toggles";
import { DeadlinePicker } from "./deadline-picker";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { getContact } from "@/lib/holded/api";
import type { HoldedContact } from "@/lib/holded/types";
import { ProjectItems } from "./project-items";
import { ProjectDocuments } from "./project-documents";
import { ProjectShipping } from "./project-shipping";
import { CopyTrackingLink } from "./copy-tracking-link";
import ProjectEmails from "./project-emails";
import LinkLead from "./link-lead";
import { listFolderFiles } from "@/lib/google-drive/client";
import ProjectChecklist from "./project-checklist";

const STATUSES = [
  { value: "pending", label: "Pending" },
  { value: "design", label: "Design" },
  { value: "printing", label: "Printing" },
  { value: "post_processing", label: "Post-processing" },
  { value: "qc", label: "QC" },
  { value: "shipping", label: "Shipping" },
  { value: "delivered", label: "Delivered" },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  printing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  post_processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qc: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  shipping: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

function formatMinutes(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between border-b border-zinc-100 py-2.5 last:border-0 dark:border-zinc-800">
      <span className="text-sm text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="text-sm font-medium text-zinc-900 dark:text-white">{value}</span>
    </div>
  );
}

export default async function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getUserProfile();
  if (!profile) redirect("/login");
  const canDelete = hasRole(profile.role, "manager");

  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

  // Phase 1: Parallel queries that only depend on project.id
  const [
    { data: projectItems },
    { data: printerTypes },
    { data: shippingInfo },
    { data: checklistItems },
  ] = await Promise.all([
    supabase
      .from("project_items")
      .select("*")
      .eq("project_id", id)
      .order("created_at", { ascending: true }),
    supabase
      .from("printer_types")
      .select("*")
      .order("name"),
    supabase
      .from("shipping_info")
      .select("*")
      .eq("project_id", id)
      .maybeSingle(),
    supabase
      .from("project_checklist_items")
      .select("*")
      .eq("project_id", id)
      .order("position", { ascending: true }),
  ]);

  // Phase 2: Parallel fetches that depend on project fields
  const itemIds = (projectItems ?? []).map((i) => i.id);

  // Build parallel promises for external APIs and conditional queries
  const printJobsPromise = itemIds.length > 0
    ? supabase
        .from("print_jobs")
        .select("*, printers(name)")
        .in("project_item_id", itemIds)
        .order("batch_number", { ascending: true })
    : Promise.resolve({ data: null });

  const driveFilesPromise = project.google_drive_folder_id
    ? listFolderFiles(project.google_drive_folder_id).catch(() => [])
    : Promise.resolve([]);

  const holdedContactPromise = project.holded_contact_id
    ? getContact(project.holded_contact_id).catch(() => null)
    : Promise.resolve(null);

  const leadPromise = project.lead_id
    ? supabase.from("leads").select("id, full_name, email").eq("id", project.lead_id).single()
    : Promise.resolve({ data: null });

  const templatePromise = project.template_id
    ? supabase.from("project_templates").select("name").eq("id", project.template_id).single()
    : Promise.resolve({ data: null });

  const [jobsResult, driveFilesRaw, holdedContact, leadResult, templateResult] = await Promise.all([
    printJobsPromise,
    driveFilesPromise,
    holdedContactPromise,
    leadPromise,
    templatePromise,
  ]);

  // Process print jobs
  let printJobs: Array<{
    id: string;
    project_item_id: string;
    printer_id: string | null;
    printer_type_id: string;
    batch_number: number;
    pieces_in_batch: number;
    estimated_minutes: number;
    status: string;
    position: number;
    scheduled_start: string | null;
    started_at: string | null;
    completed_at: string | null;
    created_at: string | null;
    gcode_filename: string | null;
    printer_name?: string;
  }> = [];

  if (jobsResult.data) {
    printJobs = jobsResult.data.map((j: Record<string, unknown>) => ({
      id: j.id as string,
      project_item_id: j.project_item_id as string,
      printer_id: j.printer_id as string | null,
      printer_type_id: j.printer_type_id as string,
      batch_number: j.batch_number as number,
      pieces_in_batch: j.pieces_in_batch as number,
      estimated_minutes: j.estimated_minutes as number,
      status: j.status as string,
      position: j.position as number,
      scheduled_start: j.scheduled_start as string | null,
      started_at: j.started_at as string | null,
      completed_at: j.completed_at as string | null,
      created_at: j.created_at as string | null,
      gcode_filename: j.gcode_filename as string | null,
      printer_name: (j.printers as { name: string } | null)?.name,
    }));
  }

  const driveFiles = driveFilesRaw.map((f: { id: string; name: string }) => ({ id: f.id, name: f.name }));
  const linkedLead = leadResult.data;
  const templateName = templateResult.data?.name ?? null;

  // Fetch lead activities (depends on lead existing)
  let leadActivities: Array<{
    id: string;
    activity_type: string;
    content: string | null;
    metadata: unknown;
    thread_id: string | null;
    created_at: string;
    created_by: string | null;
  }> = [];

  if (linkedLead) {
    const { data: activities } = await supabase
      .from("lead_activities")
      .select("id, activity_type, content, metadata, thread_id, created_at, created_by")
      .eq("lead_id", linkedLead.id)
      .in("activity_type", ["email_sent", "email_received"])
      .order("created_at", { ascending: false });

    leadActivities = activities || [];
  }

  const clientEmail = linkedLead?.email || project.client_email || null;

  const currentStatusColor = STATUS_COLORS[project.status] ?? STATUS_COLORS.pending;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to projects
        </Link>
      </div>

      {/* Header */}
      <div className="mb-6 space-y-3">
        <div className="flex items-start justify-between gap-4">
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {project.name}
          </h1>
          <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${currentStatusColor}`}>
            {STATUSES.find((s) => s.value === project.status)?.label ?? project.status}
          </span>
        </div>
        {project.description && (
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {project.description}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <PrioritySelector projectId={project.id} currentPriority={project.queue_priority} />
          <DeadlinePicker projectId={project.id} currentDeadline={project.deadline} />
          <CopyTrackingLink trackingToken={project.tracking_token} />
        </div>
      </div>

      {/* Items */}
      <div className="mb-6">
        <ProjectItems
          projectId={project.id}
          items={projectItems ?? []}
          printerTypes={printerTypes ?? []}
          printJobs={printJobs}
          driveFiles={driveFiles}
        />
      </div>

      {/* Checklist */}
      {checklistItems && checklistItems.length > 0 && (
        <div className="mb-6">
          <ProjectChecklist
            items={checklistItems.map((i) => ({
              id: i.id,
              name: i.name,
              item_type: i.item_type,
              position: i.position,
              completed: i.completed,
              data: i.data as { entries?: { line1: string; line2?: string; checked: boolean }[] } | null,
            }))}
            templateName={templateName}
            trackingToken={project.tracking_token}
          />
        </div>
      )}

      {/* Portal toggles */}
      <div className="mb-6">
        <PortalToggles
          projectId={project.id}
          designVisible={project.design_visible}
          designApprovedAt={project.design_approved_at}
          deliverableVisible={project.deliverable_visible}
          deliverableApprovedAt={project.deliverable_approved_at}
          paymentConfirmedAt={project.payment_confirmed_at}
        />
      </div>

      {/* Documents */}
      <div className="mb-6">
        <ProjectDocuments
          folderId={project.google_drive_folder_id}
          projectId={project.id}
        />
      </div>

      {/* Shipping */}
      <div className="mb-6">
        <ProjectShipping
          projectId={project.id}
          shippingInfo={shippingInfo}
          holdedContact={holdedContact}
        />
      </div>

      {/* Lead link + Communications */}
      <div className="mb-6 space-y-4">
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Lead vinculado</h2>
          <LinkLead projectId={project.id} linkedLead={linkedLead} />
        </div>

        <ProjectEmails
          projectId={project.id}
          activities={leadActivities}
          clientEmail={clientEmail}
        />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Details</h2>
          <DetailRow label="Type" value={project.project_type === "upcoming" ? "Upcoming (proforma)" : "Confirmed (invoiced)"} />
          {holdedContact ? (
            <>
              <DetailRow
                label="Client"
                value={
                  <span className="flex items-center gap-1.5">
                    {holdedContact.name}
                    <span className="inline-flex items-center rounded bg-green-100 px-1.5 py-0.5 text-[10px] font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
                      Holded
                    </span>
                  </span>
                }
              />
              <DetailRow label="Email" value={holdedContact.email} />
              <DetailRow label="Phone" value={holdedContact.phone || holdedContact.mobile} />
              <DetailRow label="NIF/CIF" value={holdedContact.code} />
              {holdedContact.billAddress?.address && (
                <DetailRow
                  label="Address"
                  value={[
                    holdedContact.billAddress.address,
                    holdedContact.billAddress.postalCode,
                    holdedContact.billAddress.city,
                    holdedContact.billAddress.province,
                  ].filter(Boolean).join(", ")}
                />
              )}
            </>
          ) : (
            <>
              <DetailRow label="Client" value={project.client_name} />
              <DetailRow label="Email" value={project.client_email} />
            </>
          )}
          <DetailRow label="Material" value={project.material} />
          <DetailRow label="Printer" value={project.assigned_printer} />
          <DetailRow label="Print time" value={project.print_time_minutes ? formatMinutes(project.print_time_minutes) : null} />
          <DetailRow label="Price" value={project.price !== null ? `${Number(project.price).toFixed(2)} €` : null} />
          <DetailRow label="Created" value={new Date(project.created_at).toLocaleString()} />
          <DetailRow label="Updated" value={new Date(project.updated_at).toLocaleString()} />
          {project.notes && (
            <div className="mt-3 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Notes</p>
              <p className="mt-1 text-sm whitespace-pre-wrap text-zinc-700 dark:text-zinc-300">{project.notes}</p>
            </div>
          )}
        </div>

        {/* Status update + actions */}
        <div className="space-y-6">
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Update status</h2>
            <form action={updateProjectStatus} className="space-y-3">
              <input type="hidden" name="id" value={project.id} />
              <select
                name="status"
                defaultValue={project.status}
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
              >
                Update status
              </button>
            </form>
          </div>

          {/* Status pipeline */}
          <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Pipeline</h2>
            <div className="space-y-2">
              {STATUSES.map((s) => {
                const isCurrent = project.status === s.value;
                const currentIdx = STATUSES.findIndex((st) => st.value === project.status);
                const thisIdx = STATUSES.findIndex((st) => st.value === s.value);
                const isPast = thisIdx < currentIdx;
                return (
                  <div
                    key={s.value}
                    className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm ${
                      isCurrent
                        ? "bg-green-50 font-medium text-green-700 dark:bg-green-900/20 dark:text-green-400"
                        : isPast
                          ? "text-zinc-400 line-through dark:text-zinc-500"
                          : "text-zinc-500 dark:text-zinc-400"
                    }`}
                  >
                    <span className={`h-2 w-2 shrink-0 rounded-full ${
                      isCurrent ? "bg-green-500" : isPast ? "bg-zinc-300 dark:bg-zinc-600" : "bg-zinc-200 dark:bg-zinc-700"
                    }`} />
                    {s.label}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Delete */}
          {canDelete && (
            <div className="rounded-xl border border-red-200 bg-white p-5 dark:border-red-900/50 dark:bg-zinc-900">
              <h2 className="mb-2 text-sm font-semibold text-red-600 dark:text-red-400">Danger zone</h2>
              <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
                This action cannot be undone. All files and shipping info will also be deleted.
              </p>
              <form action={deleteProject}>
                <input type="hidden" name="id" value={project.id} />
                <button
                  type="submit"
                  className="rounded-lg border border-red-300 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  Delete project
                </button>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
