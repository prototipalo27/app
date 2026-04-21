import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { createSnippet, deleteSnippet } from "@/app/dashboard/settings/email-snippets/actions";

const CATEGORIES = [
  { id: "saludo", label: "Saludo" },
  { id: "pagos", label: "Pagos" },
  { id: "envios", label: "Envios" },
  { id: "plazos", label: "Plazos" },
  { id: "materiales", label: "Materiales" },
  { id: "cierre", label: "Cierre" },
] as const;

const CATEGORY_COLORS: Record<string, string> = {
  saludo: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  pagos: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  envios: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  plazos: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  materiales: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  cierre: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
};

export default async function EmailsPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  await requireRole("manager");
  const supabase = await createClient();
  const params = await searchParams;
  const tab = params.tab || "sent";

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Emails
        </h1>
      </div>

      {/* Tabs */}
      <div className="mb-4 flex gap-1 rounded-lg border border-zinc-200 bg-zinc-100 p-1 dark:border-zinc-800 dark:bg-zinc-900">
        <Link
          href="/dashboard/emails?tab=sent"
          className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
            tab === "sent"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Enviados
        </Link>
        <Link
          href="/dashboard/emails?tab=snippets"
          className={`flex-1 rounded-md px-4 py-2 text-center text-sm font-medium transition-colors ${
            tab === "snippets"
              ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
              : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          }`}
        >
          Frases de email
        </Link>
      </div>

      {tab === "sent" ? (
        <SentEmailsTab />
      ) : (
        <SnippetsTab />
      )}
    </div>
  );
}

async function SentEmailsTab() {
  const supabase = await createClient();

  const { data: emails } = await supabase
    .from("sent_emails")
    .select("id, to, cc, subject, sent_at, gmail_message_id, gmail_thread_id, user_id, entity_type, entity_id")
    .order("sent_at", { ascending: false })
    .limit(200);

  // Sender names (skip null user_id — system-triggered emails)
  const senderIds = [...new Set((emails || []).map((e) => e.user_id).filter((id): id is string => !!id))];
  const { data: senders } = senderIds.length > 0
    ? await supabase.from("user_profiles").select("id, email, full_name").in("id", senderIds)
    : { data: [] };
  const senderMap = new Map(senders?.map((s) => [s.id, { email: s.email.split("@")[0], name: s.full_name }]) || []);

  // Lead names
  const leadIds = [...new Set((emails || []).filter((e) => e.entity_type === "lead" && e.entity_id).map((e) => e.entity_id!))];
  const { data: leads } = leadIds.length > 0
    ? await supabase.from("leads").select("id, full_name, company").in("id", leadIds)
    : { data: [] };
  const leadMap = new Map(leads?.map((l) => [l.id, { name: l.full_name, company: l.company }]) || []);

  // Project names (status-change and shipping emails)
  const projectIds = [...new Set((emails || []).filter((e) => e.entity_type === "project" && e.entity_id).map((e) => e.entity_id!))];
  const { data: projects } = projectIds.length > 0
    ? await supabase.from("projects").select("id, name, client_name").in("id", projectIds)
    : { data: [] };
  const projectMap = new Map(projects?.map((p) => [p.id, { name: p.name, client: p.client_name }]) || []);

  if (!emails || emails.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <p className="text-sm text-muted-foreground">No hay emails enviados todavia.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs font-medium text-muted-foreground">
                <th className="px-4 py-3">Fecha</th>
                <th className="px-4 py-3">Enviado por</th>
                <th className="px-4 py-3">Destinatario</th>
                <th className="px-4 py-3">Asunto</th>
                <th className="px-4 py-3">Relacionado con</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {emails.map((email) => {
                const sender = email.user_id ? senderMap.get(email.user_id) : null;
                const lead = email.entity_type === "lead" && email.entity_id
                  ? leadMap.get(email.entity_id)
                  : null;
                const project = email.entity_type === "project" && email.entity_id
                  ? projectMap.get(email.entity_id)
                  : null;

                return (
                  <tr key={email.id} className="hover:bg-muted/50">
                    <td className="whitespace-nowrap px-4 py-3 text-xs text-muted-foreground">
                      {new Date(email.sent_at).toLocaleDateString("es-ES", {
                        day: "numeric",
                        month: "short",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      <Badge variant="secondary" className="text-[10px]">
                        {sender?.email ?? (email.user_id ? "—" : "Sistema")}
                      </Badge>
                    </td>
                    <td className="px-4 py-3 text-foreground">
                      <span className="block max-w-[200px] truncate">{email.to}</span>
                      {email.cc && (
                        <span className="block max-w-[200px] truncate text-[10px] text-muted-foreground">
                          CC: {email.cc}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <span className="block max-w-[250px] truncate font-medium text-foreground">
                        {email.subject}
                      </span>
                    </td>
                    <td className="whitespace-nowrap px-4 py-3">
                      {lead && email.entity_id ? (
                        <Link
                          href={`/dashboard/crm/${email.entity_id}`}
                          className="text-xs text-blue-600 hover:underline dark:text-blue-400"
                        >
                          {lead.name}
                          {lead.company && (
                            <span className="text-muted-foreground"> · {lead.company}</span>
                          )}
                        </Link>
                      ) : project && email.entity_id ? (
                        <Link
                          href={`/dashboard/projects/${email.entity_id}`}
                          className="text-xs text-green-600 hover:underline dark:text-green-400"
                        >
                          {project.name}
                          {project.client && (
                            <span className="text-muted-foreground"> · {project.client}</span>
                          )}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

async function SnippetsTab() {
  const supabase = await createClient();

  const { data: snippets } = await supabase
    .from("email_snippets")
    .select("*")
    .order("category")
    .order("sort_order", { ascending: true });

  const grouped = CATEGORIES.map((cat) => ({
    ...cat,
    snippets: (snippets || []).filter((s) => s.category === cat.id),
  }));

  return (
    <div>
      {/* New snippet form */}
      <form
        action={createSnippet}
        className="mb-6 space-y-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
      >
        <div className="flex gap-3">
          <input
            type="text"
            name="title"
            required
            placeholder="Titulo del snippet..."
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <select
            name="category"
            required
            className="rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {CATEGORIES.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.label}
              </option>
            ))}
          </select>
        </div>
        <textarea
          name="content"
          required
          rows={3}
          placeholder="Contenido del snippet..."
          className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
        />
        <div className="flex justify-end">
          <button
            type="submit"
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark"
          >
            Crear snippet
          </button>
        </div>
      </form>

      {/* Snippets grouped by category */}
      <div className="space-y-6">
        {grouped.map((group) => (
          <div key={group.id}>
            <div className="mb-2 flex items-center gap-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${CATEGORY_COLORS[group.id]}`}>
                {group.label}
              </span>
              <span className="text-xs text-zinc-400 dark:text-zinc-500">
                {group.snippets.length} snippets
              </span>
            </div>

            {group.snippets.length > 0 ? (
              <div className="space-y-2">
                {group.snippets.map((snippet) => (
                  <div
                    key={snippet.id}
                    className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <h3 className="text-sm font-semibold text-zinc-900 dark:text-white">
                          {snippet.title}
                        </h3>
                        <p className="mt-1 whitespace-pre-wrap text-xs text-zinc-600 dark:text-zinc-400">
                          {snippet.content}
                        </p>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <Link
                          href={`/dashboard/settings/email-snippets/${snippet.id}`}
                          className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
                        >
                          Editar
                        </Link>
                        <form
                          action={async () => {
                            "use server";
                            await deleteSnippet(snippet.id);
                          }}
                        >
                          <button
                            type="submit"
                            className="rounded-lg border border-red-300 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-900/20"
                          >
                            Eliminar
                          </button>
                        </form>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="rounded-lg border border-dashed border-zinc-200 py-4 text-center text-xs text-zinc-400 dark:border-zinc-700 dark:text-zinc-500">
                Sin snippets en esta categoria.
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
