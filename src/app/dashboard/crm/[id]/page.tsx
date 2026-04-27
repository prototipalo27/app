import { Suspense } from "react";
import { createClient } from "@/lib/supabase/server";
import { notFound, redirect } from "next/navigation";
import Link from "next/link";
import { getUserProfile, hasRole } from "@/lib/rbac";
import LeadActions from "./lead-actions";
import LeadNav from "./lead-nav";
import LinkClient from "./link-client";
import EmailPanel from "./email-panel";
import AttachmentGallery from "./attachment-gallery";
import EditableContactInfo from "./editable-contact-info";
import InlineAssignSelect from "./inline-assign-select";
import { FollowUpSection } from "./follow-up-section";
import ProformaEditor from "./proforma-editor";
import {
  LEAD_COLUMNS,
  STATUS_LABELS,
  ACTIVITY_COLORS,
  ACTIVITY_LABELS,
  type LeadStatus,
  type ActivityType,
} from "@/lib/crm-config";
import { classifyTrafficSource, SOURCE_COLORS } from "@/lib/utm-utils";
import { getBasePrices, getCommissionSummary, getNdaStatus } from "../actions";
import { tagClasses } from "@/lib/tag-colors";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";

// ── Skeleton loaders ────────────────────────────────────────

function CardSkeleton({ lines = 3 }: { lines?: number }) {
  return (
    <Card>
      <CardContent className="animate-pulse space-y-3 py-6">
        {Array.from({ length: lines }).map((_, i) => (
          <div key={i} className="h-4 rounded bg-muted" style={{ width: `${70 + Math.random() * 30}%` }} />
        ))}
      </CardContent>
    </Card>
  );
}

function ActionsSkeleton() {
  return (
    <Card>
      <CardContent className="animate-pulse space-y-4 py-6">
        <div className="h-8 w-full rounded bg-muted" />
        <div className="h-8 w-full rounded bg-muted" />
        <div className="h-8 w-3/4 rounded bg-muted" />
        <div className="h-24 w-full rounded bg-muted" />
      </CardContent>
    </Card>
  );
}

// ── Async streamed sections ─────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  pending: "bg-secondary text-secondary-foreground",
  design: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  printing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  post_processing: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  qc: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  shipping: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  delivered: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

async function UtmSection({ leadId, leadSource }: { leadId: string; leadSource: string }) {
  const supabase = await createClient();
  const { data: utm } = await supabase
    .from("lead_utm_data")
    .select("utm_source, utm_medium, utm_campaign, utm_term, utm_content, landing_page, referrer, gclid, fbclid, first_touch_timestamp, last_touch_timestamp")
    .eq("lead_id", leadId)
    .maybeSingle();

  if (!utm) return null;

  const trafficSource = classifyTrafficSource(leadSource, utm);
  const color = SOURCE_COLORS[trafficSource];

  const fields: { label: string; value: string | null }[] = [
    { label: "Fuente", value: utm.utm_source },
    { label: "Medio", value: utm.utm_medium },
    { label: "Campaña", value: utm.utm_campaign },
    { label: "Término", value: utm.utm_term },
    { label: "Contenido", value: utm.utm_content },
    { label: "Landing page", value: utm.landing_page },
    { label: "Referrer", value: utm.referrer },
    { label: "gclid", value: utm.gclid },
    { label: "fbclid", value: utm.fbclid },
    { label: "Primer toque", value: utm.first_touch_timestamp ? new Date(utm.first_touch_timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null },
    { label: "Último toque", value: utm.last_touch_timestamp ? new Date(utm.last_touch_timestamp).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" }) : null },
  ].filter((f) => f.value);

  return (
    <Card>
      <CardContent>
        <div className="mb-3 flex items-center gap-2">
          <h3 className="text-sm font-semibold text-card-foreground">Atribución</h3>
          <Badge
            variant="secondary"
            style={{ backgroundColor: `${color}20`, color }}
            className="text-[10px] font-semibold"
          >
            {trafficSource}
          </Badge>
        </div>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          {fields.map((f) => (
            <div key={f.label}>
              <p className="text-[10px] font-medium uppercase text-muted-foreground">{f.label}</p>
              <p className="truncate text-xs text-foreground">{f.value}</p>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function LinkedProjectsSection({ leadId }: { leadId: string }) {
  const supabase = await createClient();
  const { data: linkedProjects } = await supabase
    .from("projects")
    .select("id, name, status, project_type")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  if (!linkedProjects || linkedProjects.length === 0) return null;

  return (
    <Card>
      <CardContent>
        <h3 className="mb-3 text-sm font-semibold text-card-foreground">
          Proyectos vinculados ({linkedProjects.length})
        </h3>
        <div className="space-y-2">
          {linkedProjects.map((project) => (
            <Link
              key={project.id}
              href={`/dashboard/projects/${project.id}`}
              className="flex items-center justify-between rounded-lg border px-4 py-3 hover:bg-muted/50"
            >
              <div>
                <span className="text-sm font-medium text-foreground">{project.name}</span>
                <span className="ml-2 text-xs text-muted-foreground">
                  {project.project_type === "upcoming" ? "Proforma" : "Confirmado"}
                </span>
              </div>
              <Badge variant="secondary" className={STATUS_COLORS[project.status] || STATUS_COLORS.pending}>
                {project.status}
              </Badge>
            </Link>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

async function ProformaSection({ leadId, lead }: { leadId: string; lead: any }) {
  const supabase = await createClient();
  const [{ data: quoteRequest }, basePrices] = await Promise.all([
    supabase.from("quote_requests").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    getBasePrices(),
  ]);

  return (
    <ProformaEditor
      leadId={leadId}
      existingItems={(quoteRequest?.items as { concept: string; price: number; units: number; tax: number }[] | null) || null}
      existingNotes={quoteRequest?.notes || null}
      quoteStatus={quoteRequest?.status || null}
      holdedEstimateId={quoteRequest?.holded_estimate_id || null}
      projectTypeTag={lead.project_type_tag}
      estimatedQuantity={lead.estimated_quantity}
      estimatedComplexity={lead.estimated_complexity}
      estimatedUrgency={lead.estimated_urgency}
      estimatedExactQuantity={lead.estimated_exact_quantity}
      basePrices={basePrices}
    />
  );
}

async function EmailSection({ leadId, lead }: { leadId: string; lead: any }) {
  const supabase = await createClient();
  const [{ data: activities }, { data: quoteRequest }, { data: snippets }, { data: emailResources }] = await Promise.all([
    supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
    supabase.from("quote_requests").select("holded_proforma_id").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("email_snippets").select("id, title, category, content").order("category").order("sort_order", { ascending: true }),
    supabase.from("tools_resources").select("id, title, type, content, category").in("type", ["imagen", "archivo"]).order("category").order("title"),
  ]);

  return (
    <EmailPanel
      activities={activities || []}
      leadId={leadId}
      leadEmail={lead.email}
      leadName={lead.full_name}
      leadCompany={lead.company}
      emailSubjectTag={lead.email_subject_tag}
      leadNumber={lead.lead_number}
      holdedProformaId={quoteRequest?.holded_proforma_id || null}
      snippets={snippets || []}
      emailResources={emailResources || []}
      leadMessage={lead.message}
      aiDraft={lead.ai_draft}
    />
  );
}

async function ActivitySection({ leadId }: { leadId: string }) {
  const supabase = await createClient();
  const { data: activities } = await supabase
    .from("lead_activities")
    .select("*")
    .eq("lead_id", leadId)
    .order("created_at", { ascending: false });

  // Build user map from activity creators (depends on activities result)
  const creatorIds = [...new Set((activities || []).map((a) => a.created_by).filter(Boolean))] as string[];
  const userMap = creatorIds.length > 0
    ? await supabase.from("user_profiles").select("id, email").in("id", creatorIds)
        .then(({ data: users }) => new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []))
    : new Map<string, string>();

  return (
    <Card>
      <CardContent>
        <h3 className="mb-4 text-sm font-semibold text-card-foreground">
          Actividad ({activities?.length || 0})
        </h3>
        {(!activities || activities.length === 0) ? (
          <p className="text-sm text-muted-foreground">Sin actividad registrada.</p>
        ) : (
          <div className="space-y-4">
            {activities.map((activity) => {
              const actType = activity.activity_type as ActivityType;
              const metadata = activity.metadata as Record<string, unknown> | null;
              return (
                <div key={activity.id} className="flex gap-3">
                  <div className="mt-0.5">
                    <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full text-[10px] font-bold ${ACTIVITY_COLORS[actType] || ""}`}>
                      {actType === "note" && "N"}
                      {actType === "email_sent" && "E"}
                      {actType === "email_received" && "R"}
                      {actType === "status_change" && "S"}
                      {actType === "call" && "C"}
                    </span>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-medium text-foreground">{ACTIVITY_LABELS[actType] || actType}</span>
                      {activity.created_by && (
                        <span className="text-xs text-muted-foreground">por {userMap.get(activity.created_by) || "—"}</span>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {new Date(activity.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      </span>
                    </div>
                    {actType === "email_sent" && metadata && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        Para: {String(metadata.email_to || "")} — Asunto: {String(metadata.email_subject || "")}
                      </p>
                    )}
                    {actType === "email_received" && metadata && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        De: {String(metadata.email_from_name || metadata.email_from || "")} — Asunto: {String(metadata.email_subject || "")}
                      </p>
                    )}
                    {actType === "status_change" && metadata && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {STATUS_LABELS[metadata.old_status as LeadStatus] || String(metadata.old_status)}
                        {" → "}
                        {STATUS_LABELS[metadata.new_status as LeadStatus] || String(metadata.new_status)}
                      </p>
                    )}
                    {activity.content && (
                      <p className="mt-1 whitespace-pre-wrap text-sm text-muted-foreground">{activity.content}</p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

async function SentEmailsSection({ leadId }: { leadId: string }) {
  const supabase = await createClient();
  const { data: sentEmails } = await supabase
    .from("sent_emails")
    .select("id, to, cc, subject, sent_at, gmail_message_id, user_id")
    .eq("entity_type", "lead")
    .eq("entity_id", leadId)
    .order("sent_at", { ascending: false })
    .limit(50);

  if (!sentEmails || sentEmails.length === 0) return null;

  // Get sender names
  const senderIds = [...new Set(sentEmails.map((e) => e.user_id).filter((id): id is string => id !== null))];
  const { data: senders } = senderIds.length > 0
    ? await supabase.from("user_profiles").select("id, email").in("id", senderIds)
    : { data: [] };
  const senderMap = new Map(senders?.map((s) => [s.id, s.email.split("@")[0]]) || []);

  return (
    <Card>
      <CardContent>
        <details>
          <summary className="cursor-pointer text-sm font-semibold text-card-foreground">
            Emails enviados desde la plataforma ({sentEmails.length})
          </summary>
          <div className="mt-3 space-y-2">
            {sentEmails.map((email) => (
              <div
                key={email.id}
                className="flex items-start justify-between gap-2 rounded-lg border px-3 py-2 text-xs"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-foreground truncate">{email.subject}</p>
                  <p className="text-muted-foreground">
                    Para: {email.to}
                    {email.cc && <span> · CC: {email.cc}</span>}
                  </p>
                </div>
                <div className="shrink-0 text-right text-muted-foreground">
                  <p>{new Date(email.sent_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</p>
                  <p className="text-[10px]">por {(email.user_id && senderMap.get(email.user_id)) || "—"}</p>
                </div>
              </div>
            ))}
          </div>
        </details>
      </CardContent>
    </Card>
  );
}

async function ActionsSection({ leadId, lead, nextId }: { leadId: string; lead: any; nextId: string | null }) {
  const supabase = await createClient();

  const [
    { data: managers },
    { data: quoteRequest },
    { data: projectTemplates },
    { data: followUps },
    commission,
    ndaStatusResult,
  ] = await Promise.all([
    supabase.from("user_profiles").select("id, email").in("role", ["manager", "super_admin"]).eq("is_active", true),
    supabase.from("quote_requests").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("project_templates").select("name").eq("is_active", true).order("name"),
    supabase.from("lead_follow_ups").select("id, scheduled_date, note, action_type, completed_at, created_at").eq("lead_id", leadId).order("scheduled_date"),
    getCommissionSummary(leadId),
    getNdaStatus(leadId),
  ]);

  const projectTemplateTags = (projectTemplates || []).map((t) => t.name);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent>
          <LeadActions
            leadId={leadId}
            leadEmail={lead.email}
            currentStatus={lead.status as LeadStatus}
            managers={managers || []}
            quoteRequest={quoteRequest}
            paymentCondition={lead.payment_condition}
            desiredDeliveryDate={lead.desired_delivery_date}
            projectTypeTag={lead.project_type_tag}
            projectTemplateTags={projectTemplateTags}
            estimatedQuantity={lead.estimated_quantity}
            estimatedComplexity={lead.estimated_complexity}
            estimatedUrgency={lead.estimated_urgency}
            estimatedValue={lead.estimated_value}
            nextId={nextId}
            commission={commission}
            ndaStatus={ndaStatusResult.status}
            ndaId={ndaStatusResult.id}
            ndaSignedAt={ndaStatusResult.signed_at}
            ndaSignerName={ndaStatusResult.signer_name}
          />
        </CardContent>
      </Card>
      <Card>
        <CardContent>
          <FollowUpSection leadId={leadId} followUps={followUps || []} />
        </CardContent>
      </Card>
    </div>
  );
}

// ── Main page (renders instantly with just lead data) ───────

export default async function LeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const { id } = await params;
  const supabase = await createClient();

  // Fetch lead first (needed for notFound + created_at for nav queries)
  const { data: lead } = await supabase.from("leads").select("*").eq("id", id).single();
  if (!lead) notFound();

  // Fast parallel: nav + user names + managers (all we need for first paint)
  const leadUserIds = [lead.assigned_to, lead.owned_by].filter(Boolean) as string[];
  const [{ data: prevLeads }, { data: nextLeads }, userMap, { data: managers }] = await Promise.all([
    supabase.from("leads").select("id").not("status", "in", "(won,paid,lost)").gt("created_at", lead.created_at).order("created_at", { ascending: true }).limit(1),
    supabase.from("leads").select("id").not("status", "in", "(won,paid,lost)").lt("created_at", lead.created_at).order("created_at", { ascending: false }).limit(1),
    leadUserIds.length > 0
      ? supabase.from("user_profiles").select("id, email").in("id", leadUserIds).then(({ data: users }) =>
          new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || [])
        )
      : Promise.resolve(new Map<string, string>()),
    supabase.from("user_profiles").select("id, email").in("role", ["manager", "super_admin"]).eq("is_active", true),
  ]);

  const prevId = prevLeads?.[0]?.id ?? null;
  const nextId = nextLeads?.[0]?.id ?? null;

  const statusColumn = LEAD_COLUMNS.find((c) => c.id === lead.status);

  return (
    <div className="mx-auto max-w-5xl">
      <LeadNav prevId={prevId} nextId={nextId} />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Left panel */}
        <div className="space-y-4 md:col-span-2">
          {/* Lead info — renders instantly */}
          <Card>
            <CardContent>
              <div className="mb-4 flex flex-wrap items-center gap-2">
                {statusColumn && (
                  <Badge variant="secondary" className={statusColumn.badge}>{statusColumn.label}</Badge>
                )}
                <Badge variant="secondary">{lead.source}</Badge>
                {lead.project_type_tag && (
                  <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>{lead.project_type_tag}</Badge>
                )}
                <span className="ml-auto flex items-center gap-2 text-xs text-muted-foreground">
                  {new Date(lead.created_at).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                  {(() => {
                    const days = Math.floor((Date.now() - new Date(lead.created_at).getTime()) / 86400000);
                    return (
                      <Badge variant="secondary" className={
                        days <= 3 ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                          : days <= 7 ? "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                            : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                      }>
                        {days === 0 ? "hoy" : days === 1 ? "hace 1 dia" : `hace ${days} dias`}
                      </Badge>
                    );
                  })()}
                </span>
              </div>

              <EditableContactInfo
                leadId={lead.id}
                fullName={lead.full_name}
                opportunityName={lead.opportunity_name}
                email={lead.email}
                phone={lead.phone}
                company={lead.company}
              />

              {/* Quick-action buttons — mobile-first, prominent for notification taps */}
              {(lead.phone || lead.email) && (
                <div className="mt-3 flex gap-2 md:hidden">
                  {lead.phone && (
                    <a
                      href={`tel:${lead.phone}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-green-600 px-4 py-2.5 text-sm font-medium text-white active:bg-green-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                      </svg>
                      Llamar
                    </a>
                  )}
                  {lead.email && (
                    <a
                      href={`mailto:${lead.email}`}
                      className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2.5 text-sm font-medium text-white active:bg-blue-700"
                    >
                      <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      Email
                    </a>
                  )}
                  {lead.phone && (
                    <a
                      href={`https://wa.me/${lead.phone.replace(/[^0-9+]/g, "")}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center justify-center rounded-lg bg-[#25D366] px-3 py-2.5 text-white active:bg-[#1da851]"
                      title="WhatsApp"
                    >
                      <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
                      </svg>
                    </a>
                  )}
                </div>
              )}

              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                <span className="inline-flex items-center gap-1">
                  <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                  <InlineAssignSelect
                    leadId={lead.id}
                    currentAssignedTo={lead.assigned_to}
                    managers={managers ?? []}
                    displayName={lead.assigned_to ? (userMap.get(lead.assigned_to) || "—") : null}
                  />
                </span>
                {lead.source !== "webflow" && lead.owned_by && (
                  <span className="inline-flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    Captado por {userMap.get(lead.owned_by) || "—"}
                  </span>
                )}
              </div>

              <LinkClient leadId={lead.id} />

              {lead.message && (
                <div className="mt-4 rounded-lg bg-muted p-4">
                  <p className="text-xs font-semibold uppercase text-muted-foreground">Mensaje original</p>
                  <p className="mt-1 whitespace-pre-wrap text-sm text-foreground">{lead.message}</p>
                </div>
              )}

              {lead.attachments && <AttachmentGallery attachments={lead.attachments} />}

              {lead.lost_reason && (
                <div className="mt-4 rounded-lg border border-destructive/30 bg-destructive/5 p-4">
                  <p className="text-xs font-semibold uppercase text-destructive">Motivo de perdida</p>
                  <p className="mt-1 text-sm text-destructive/80">{lead.lost_reason}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Actions panel — appears here on mobile (before heavy sections), sidebar on desktop */}
          <div className="md:hidden">
            <Suspense fallback={<ActionsSkeleton />}>
              <ActionsSection leadId={id} lead={lead} nextId={nextId} />
            </Suspense>
          </div>

          {/* Everything below streams in progressively */}
          <Suspense fallback={null}>
            <LinkedProjectsSection leadId={id} />
          </Suspense>

          <Suspense fallback={<CardSkeleton lines={4} />}>
            <ProformaSection leadId={id} lead={lead} />
          </Suspense>

          <Suspense fallback={<CardSkeleton lines={5} />}>
            <EmailSection leadId={id} lead={lead} />
          </Suspense>

          <Suspense fallback={<CardSkeleton lines={6} />}>
            <ActivitySection leadId={id} />
          </Suspense>

          {/* UTM attribution — at the end, low priority info */}
          <Suspense fallback={null}>
            <UtmSection leadId={id} leadSource={lead.source} />
          </Suspense>
        </div>

        {/* Right panel — desktop only (mobile version rendered inline above) */}
        <div className="hidden md:block">
          <Suspense fallback={<ActionsSkeleton />}>
            <ActionsSection leadId={id} lead={lead} nextId={nextId} />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
