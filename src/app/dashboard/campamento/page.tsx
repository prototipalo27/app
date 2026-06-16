import { createClient } from "@/lib/supabase/server";
import { getUserProfile } from "@/lib/rbac";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";

const MAX_SLOTS = 6;

const STATUS_LABELS: Record<string, string> = {
  paid: "Pagado",
  pending: "Pendiente",
  cancelled: "Cancelado",
};

const STATUS_COLORS: Record<string, string> = {
  paid: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400",
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  cancelled: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleString("es-ES", {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default async function DashboardCampamentoPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();
  const { data: rows } = await supabase
    .from("camp_registrations")
    .select("*")
    .order("created_at", { ascending: false });

  const all = rows ?? [];
  const paid = all.filter((r) => r.status === "paid");
  const pending = all.filter((r) => r.status === "pending");
  const remaining = Math.max(0, MAX_SLOTS - paid.length);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Campamento 3D · 29 jun – 3 jul
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Inscripciones de la landing pública{" "}
          <a
            href="/campamento"
            target="_blank"
            rel="noreferrer"
            className="text-brand underline"
          >
            /campamento
          </a>
          . La señal son 50 € por Stripe; los 250 € restantes se cobran en efectivo
          el primer día.
        </p>
      </div>

      {/* Resumen */}
      <div className="mb-6 grid grid-cols-3 gap-3">
        <SummaryCard label="Inscritos (pagados)" value={`${paid.length} / ${MAX_SLOTS}`} />
        <SummaryCard label="Plazas libres" value={String(remaining)} />
        <SummaryCard label="Reservas sin pagar" value={String(pending.length)} />
      </div>

      {all.length === 0 ? (
        <div className="rounded-xl border border-dashed border-zinc-300 bg-white p-10 text-center text-sm text-zinc-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400">
          Aún no hay inscripciones. Comparte el enlace de la landing para empezar a
          recibir reservas.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-zinc-200 bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-800/50">
              <tr>
                <Th>Niño/a</Th>
                <Th>Responsable</Th>
                <Th>Contacto</Th>
                <Th>Hasta 15:00</Th>
                <Th>Estado</Th>
                <Th>Fecha</Th>
              </tr>
            </thead>
            <tbody>
              {all.map((r) => (
                <tr
                  key={r.id}
                  className="border-b border-zinc-100 last:border-0 hover:bg-zinc-50 dark:border-zinc-800/60 dark:hover:bg-zinc-800/30"
                >
                  <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">
                    {r.child_name}
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {r.payer_name}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <a
                        href={`mailto:${r.payer_email}`}
                        className="text-brand hover:underline"
                      >
                        {r.payer_email}
                      </a>
                      <a
                        href={`tel:${r.payer_phone.replace(/\s+/g, "")}`}
                        className="text-zinc-500 hover:underline dark:text-zinc-400"
                      >
                        {r.payer_phone}
                      </a>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-zinc-700 dark:text-zinc-300">
                    {r.extended_hours ? "Sí" : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                        STATUS_COLORS[r.status] ?? STATUS_COLORS.cancelled
                      }`}
                    >
                      {STATUS_LABELS[r.status] ?? r.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-zinc-500 dark:text-zinc-400">
                    {formatDate(r.created_at)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
      <div className="text-xs font-medium tracking-wide text-zinc-500 uppercase dark:text-zinc-400">
        {label}
      </div>
      <div className="mt-1 text-2xl font-bold text-zinc-900 dark:text-white">
        {value}
      </div>
    </div>
  );
}

function Th({ children }: { children: React.ReactNode }) {
  return (
    <th className="px-4 py-3 font-medium text-zinc-700 dark:text-zinc-300">
      {children}
    </th>
  );
}
