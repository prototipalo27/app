import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import Link from "next/link";
import RequestActions from "./request-actions";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";

const STATUS_LABELS: Record<string, string> = {
  pending: "Pendiente",
  accepted: "Aceptada",
  rejected: "Rechazada",
  resolved: "Resuelta",
  confirmed: "Confirmada",
};

const STATUS_COLORS: Record<string, string> = {
  pending:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  accepted:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  rejected:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  resolved:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  confirmed:
    "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
};

const TYPE_LABELS: Record<string, string> = {
  feature: "Funcionalidad",
  improvement: "Mejora",
  bug: "Bug",
};

const TYPE_COLORS: Record<string, string> = {
  feature:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400",
  improvement:
    "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  bug: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const PRIORITY_LABELS: Record<string, string> = {
  low: "Baja",
  medium: "Media",
  high: "Alta",
  urgent: "Urgente",
};

const PRIORITY_COLORS: Record<string, string> = {
  low: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  medium:
    "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  high: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  urgent:
    "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

export default async function RequestDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const { id } = await params;
  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("*")
    .eq("id", id)
    .single();

  if (!request) notFound();

  // Fetch user names for display
  const userIds = [
    request.requested_by,
    request.reviewed_by,
    request.resolved_by,
  ].filter(Boolean) as string[];

  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email")
    .in("id", userIds);

  const userMap = new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []);

  const isManager = hasRole(profile.role, "manager");

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-6">
        <Link
          href="/dashboard/requests"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Volver a solicitudes
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="md:col-span-2">
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  STATUS_COLORS[request.status] || ""
                }`}
              >
                {STATUS_LABELS[request.status] || request.status}
              </span>
              <span
                className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                  TYPE_COLORS[request.request_type] || ""
                }`}
              >
                {TYPE_LABELS[request.request_type] || request.request_type}
              </span>
              {request.priority && (
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    PRIORITY_COLORS[request.priority] || ""
                  }`}
                >
                  {PRIORITY_LABELS[request.priority] || request.priority}
                </span>
              )}
            </div>

            <h1 className="text-xl font-bold text-zinc-900 dark:text-white">
              {request.title}
            </h1>

            <p className="mt-4 whitespace-pre-wrap text-sm text-zinc-600 dark:text-zinc-400">
              {request.description}
            </p>

            {/* Manager notes (rejection reason) */}
            {request.manager_notes && (
              <div className="mt-6 rounded-lg border border-red-200 bg-red-50 p-4 dark:border-red-800 dark:bg-red-900/10">
                <p className="text-xs font-semibold uppercase text-red-700 dark:text-red-400">
                  Motivo del rechazo
                </p>
                <p className="mt-1 text-sm text-red-600 dark:text-red-300">
                  {request.manager_notes}
                </p>
              </div>
            )}

            {/* Resolution notes */}
            {request.resolved_notes && (
              <div className="mt-6 rounded-lg border border-purple-200 bg-purple-50 p-4 dark:border-purple-800 dark:bg-purple-900/10">
                <p className="text-xs font-semibold uppercase text-purple-700 dark:text-purple-400">
                  Notas de resolucion
                </p>
                <p className="mt-1 text-sm text-purple-600 dark:text-purple-300">
                  {request.resolved_notes}
                </p>
              </div>
            )}
          </div>

          {/* Timeline info */}
          <div className="mt-4 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <h3 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
              Historial
            </h3>
            <div className="space-y-2 text-sm text-zinc-500 dark:text-zinc-400">
              <p>
                Creada por{" "}
                <span className="font-medium text-zinc-700 dark:text-zinc-300">
                  {userMap.get(request.requested_by) || "—"}
                </span>
                {" el "}
                {new Date(request.created_at).toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "short",
                  year: "numeric",
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </p>
              {request.reviewed_at && request.reviewed_by && (
                <p>
                  Revisada por{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {userMap.get(request.reviewed_by) || "—"}
                  </span>
                  {" el "}
                  {new Date(request.reviewed_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {request.resolved_at && request.resolved_by && (
                <p>
                  Resuelta por{" "}
                  <span className="font-medium text-zinc-700 dark:text-zinc-300">
                    {userMap.get(request.resolved_by) || "—"}
                  </span>
                  {" el "}
                  {new Date(request.resolved_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
              {request.confirmed_at && (
                <p>
                  Confirmada el{" "}
                  {new Date(request.confirmed_at).toLocaleDateString("es-ES", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                    hour: "2-digit",
                    minute: "2-digit",
                  })}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Sidebar with actions */}
        <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
          <RequestActions
            requestId={request.id}
            status={request.status}
            priority={request.priority}
            requestedBy={request.requested_by}
            currentUserId={profile.id}
            isManager={isManager}
          />
        </div>
      </div>
    </div>
  );
}
