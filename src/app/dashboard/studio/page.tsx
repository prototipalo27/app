import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import Link from "next/link";
import { getUserProfile } from "@/lib/rbac";

const STATUS_LABELS: Record<string, string> = {
  brief: "Brief",
  propuesta: "Propuesta",
  en_curso: "En curso",
  entregado: "Entregado",
  cerrado: "Cerrado",
  cancelado: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  brief: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  propuesta: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  en_curso: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  entregado: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  cerrado: "bg-zinc-200 text-zinc-600 dark:bg-zinc-700 dark:text-zinc-400",
  cancelado: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
};

const ORDER = ["brief", "propuesta", "en_curso", "entregado", "cerrado", "cancelado"];

function formatEur(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Number(value).toLocaleString("es-ES", { minimumFractionDigits: 0, maximumFractionDigits: 2 })} €`;
}

export default async function StudioIndexPage() {
  const profile = await getUserProfile();
  if (!profile) redirect("/login");

  const supabase = await createClient();

  const [{ data: projects }, { data: payments }] = await Promise.all([
    supabase
      .from("studio_projects")
      .select("id, name, status, client_name, total_price, currency, expected_end_date, project_manager_id, created_at")
      .order("created_at", { ascending: false }),
    supabase
      .from("studio_payments")
      .select("studio_project_id, amount, status"),
  ]);

  const cobradoByProject = new Map<string, number>();
  for (const p of payments ?? []) {
    if (p.status === "cobrado") {
      cobradoByProject.set(
        p.studio_project_id,
        (cobradoByProject.get(p.studio_project_id) ?? 0) + Number(p.amount),
      );
    }
  }

  const totalCartera = (projects ?? []).reduce((acc, p) => acc + Number(p.total_price ?? 0), 0);
  const totalCobrado = Array.from(cobradoByProject.values()).reduce((a, b) => a + b, 0);
  const activos = (projects ?? []).filter((p) => p.status !== "cerrado" && p.status !== "cancelado").length;

  return (
    <div className="mx-auto max-w-6xl">
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Prototipalo Studio</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Proyectos premium: desarrollo de patentes, consultoría de diseño y entregables a medida.
          </p>
        </div>
        <Link
          href="/dashboard/studio/new"
          className="shrink-0 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
        >
          Nuevo proyecto Studio
        </Link>
      </div>

      {/* KPIs */}
      <div className="mb-6 grid gap-3 sm:grid-cols-3">
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cartera total</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{formatEur(totalCartera)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Cobrado</p>
          <p className="mt-1 text-xl font-bold text-green-600 dark:text-green-400">{formatEur(totalCobrado)}</p>
        </div>
        <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400">Proyectos activos</p>
          <p className="mt-1 text-xl font-bold text-zinc-900 dark:text-white">{activos}</p>
        </div>
      </div>

      {/* Lista */}
      {!projects || projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-12 text-center dark:border-zinc-700 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            Aún no hay proyectos Studio. Crea el primero para empezar.
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          {[...projects]
            .sort((a, b) => ORDER.indexOf(a.status) - ORDER.indexOf(b.status))
            .map((p) => {
              const cobrado = cobradoByProject.get(p.id) ?? 0;
              const total = Number(p.total_price ?? 0);
              const pct = total > 0 ? Math.min(100, Math.round((cobrado / total) * 100)) : 0;
              return (
                <Link
                  key={p.id}
                  href={`/dashboard/studio/${p.id}`}
                  className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:shadow-sm dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h2 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">{p.name}</h2>
                        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${STATUS_COLORS[p.status] ?? STATUS_COLORS.brief}`}>
                          {STATUS_LABELS[p.status] ?? p.status}
                        </span>
                      </div>
                      {p.client_name && (
                        <p className="mt-0.5 truncate text-xs text-zinc-500 dark:text-zinc-400">{p.client_name}</p>
                      )}
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-semibold text-zinc-900 dark:text-white">{formatEur(total)}</p>
                      {total > 0 && (
                        <p className="text-[11px] text-zinc-500 dark:text-zinc-400">
                          {formatEur(cobrado)} cobrado · {pct}%
                        </p>
                      )}
                    </div>
                  </div>
                  {total > 0 && (
                    <div className="mt-3 h-1 overflow-hidden rounded-full bg-zinc-100 dark:bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-green-500 transition-all"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  )}
                </Link>
              );
            })}
        </div>
      )}
    </div>
  );
}
