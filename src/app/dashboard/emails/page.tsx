import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

export default async function SentEmailsPage() {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: emails } = await supabase
    .from("sent_emails")
    .select("id, to, cc, subject, sent_at, gmail_message_id, gmail_thread_id, user_id, entity_type, entity_id")
    .order("sent_at", { ascending: false })
    .limit(200);

  // Get sender names
  const senderIds = [...new Set((emails || []).map((e) => e.user_id))];
  const { data: senders } = senderIds.length > 0
    ? await supabase.from("user_profiles").select("id, email, full_name").in("id", senderIds)
    : { data: [] };
  const senderMap = new Map(senders?.map((s) => [s.id, { email: s.email.split("@")[0], name: s.full_name }]) || []);

  // Get lead names for linked emails
  const leadIds = [...new Set((emails || []).filter((e) => e.entity_type === "lead" && e.entity_id).map((e) => e.entity_id!))];
  const { data: leads } = leadIds.length > 0
    ? await supabase.from("leads").select("id, full_name, company").in("id", leadIds)
    : { data: [] };
  const leadMap = new Map(leads?.map((l) => [l.id, { name: l.full_name, company: l.company }]) || []);

  return (
    <div className="mx-auto max-w-5xl">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Emails enviados
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Todos los emails enviados desde la plataforma via Gmail API.
        </p>
      </div>

      {(!emails || emails.length === 0) ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-sm text-muted-foreground">No hay emails enviados todavia.</p>
          </CardContent>
        </Card>
      ) : (
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
                    <th className="px-4 py-3">Lead</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {emails.map((email) => {
                    const sender = senderMap.get(email.user_id);
                    const lead = email.entity_type === "lead" && email.entity_id
                      ? leadMap.get(email.entity_id)
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
                            {sender?.email || "—"}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-foreground">
                          <span className="block truncate max-w-[200px]">{email.to}</span>
                          {email.cc && (
                            <span className="block truncate max-w-[200px] text-[10px] text-muted-foreground">
                              CC: {email.cc}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          <span className="block truncate max-w-[250px] font-medium text-foreground">
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
      )}
    </div>
  );
}
