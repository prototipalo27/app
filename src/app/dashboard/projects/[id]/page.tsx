import { createClient } from "@/lib/supabase/server";
import { redirect, notFound } from "next/navigation";
import Link from "next/link";
import { updateProjectStatus, deleteProject } from "../actions";

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
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("*")
    .eq("id", id)
    .single();

  if (!project) {
    notFound();
  }

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
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
            {project.name}
          </h1>
          {project.description && (
            <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
              {project.description}
            </p>
          )}
        </div>
        <span className={`shrink-0 rounded-full px-3 py-1 text-sm font-medium ${currentStatusColor}`}>
          {STATUSES.find((s) => s.value === project.status)?.label ?? project.status}
        </span>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Details */}
        <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">Details</h2>
          <DetailRow label="Type" value={project.project_type === "upcoming" ? "Upcoming (proforma)" : "Confirmed (invoiced)"} />
          <DetailRow label="Client" value={project.client_name} />
          <DetailRow label="Email" value={project.client_email} />
          <DetailRow label="Material" value={project.material} />
          <DetailRow label="Printer" value={project.assigned_printer} />
          <DetailRow label="Print time" value={project.print_time_minutes ? formatMinutes(project.print_time_minutes) : null} />
          <DetailRow label="Price" value={project.price !== null ? `${Number(project.price).toFixed(2)}` : null} />
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
                className="block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              >
                {STATUSES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <button
                type="submit"
                className="w-full rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
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
        </div>
      </div>
    </div>
  );
}
