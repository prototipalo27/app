import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

function StatusBadge({ status }: { status: string | null }) {
  const s = status?.toLowerCase() ?? "unknown";
  let classes = "rounded-full px-2 py-0.5 text-xs font-medium ";

  if (s === "delivered") {
    classes += "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400";
  } else if (s.includes("transit") || s === "in_transit") {
    classes += "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400";
  } else {
    classes += "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400";
  }

  return <span className={classes}>{status ?? "unknown"}</span>;
}

export default async function ShipmentsPage() {
  const supabase = await createClient();

  const { data: shipments } = await supabase
    .from("shipping_info")
    .select("*, projects(id, name)")
    .order("created_at", { ascending: false });

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">Envios</h1>
        <Link
          href="/dashboard/shipments/new"
          className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-medium text-white hover:bg-cyan-700 focus:ring-2 focus:ring-cyan-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-black"
        >
          Nuevo envio
        </Link>
      </div>

      {!shipments?.length ? (
        <div className="rounded-xl border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            No shipments yet. Create your first one.
          </p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Title / Project</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Recipient</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 md:table-cell">Destination</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 lg:table-cell">Carrier</th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">Status</th>
                <th className="hidden px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400 sm:table-cell">Date</th>
              </tr>
            </thead>
            <tbody>
              {shipments.map((s) => {
                const project = s.projects as { id: string; name: string } | null;
                const label = s.title || project?.name || s.packlink_shipment_ref || "Untitled";

                return (
                  <tr
                    key={s.id}
                    className="border-b border-zinc-100 last:border-0 dark:border-zinc-800/50"
                  >
                    <td className="px-4 py-3">
                      <Link
                        href={`/dashboard/shipments/${s.id}`}
                        className="font-medium text-zinc-900 hover:text-cyan-600 dark:text-white dark:hover:text-cyan-400"
                      >
                        {label}
                      </Link>
                      {project && !s.title && (
                        <span className="ml-2 text-xs text-zinc-400">project</span>
                      )}
                      {!project && s.title && (
                        <span className="ml-2 text-xs text-zinc-400">standalone</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {s.recipient_name ?? "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-300 md:table-cell">
                      {[s.city, s.country].filter(Boolean).join(", ") || "—"}
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-600 dark:text-zinc-300 lg:table-cell">
                      {s.carrier ?? "—"}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={s.shipment_status} />
                    </td>
                    <td className="hidden px-4 py-3 text-zinc-500 dark:text-zinc-400 sm:table-cell">
                      {s.created_at
                        ? new Date(s.created_at).toLocaleDateString("es-ES", {
                            day: "2-digit",
                            month: "short",
                          })
                        : s.shipped_at
                          ? new Date(s.shipped_at).toLocaleDateString("es-ES", {
                              day: "2-digit",
                              month: "short",
                            })
                          : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
