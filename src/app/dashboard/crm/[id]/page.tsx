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
import { getBasePrices, getCommissionSummary, getNdaStatus, getMyCommissionData } from "../actions";
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
    .select("*")
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
  const [{ data: activities }] = await Promise.all([
    supabase.from("lead_activities").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }),
  ]);

  // Build user map from activity creators
  const creatorIds = [...new Set((activities || []).map((a) => a.created_by).filter(Boolean))] as string[];
  let userMap = new Map<string, string>();
  if (creatorIds.length > 0) {
    const { data: users } = await supabase.from("user_profiles").select("id, email").in("id", creatorIds);
    userMap = new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

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

async function ActionsSection({ leadId, lead, nextId }: { leadId: string; lead: any; nextId: string | null }) {
  const supabase = await createClient();

  const [
    { data: managers },
    { data: quoteRequest },
    { data: projectTemplates },
    commission,
    ndaStatusResult,
  ] = await Promise.all([
    supabase.from("user_profiles").select("id, email").in("role", ["manager", "super_admin"]).eq("is_active", true),
    supabase.from("quote_requests").select("*").eq("lead_id", leadId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    supabase.from("project_templates").select("name").eq("is_active", true).order("name"),
    getCommissionSummary(leadId),
    getNdaStatus(leadId),
  ]);

  const projectTemplateTags = (projectTemplates || []).map((t) => t.name);

  return (
    <Card>
      <CardContent>
        <LeadActions
          leadId={leadId}
          leadEmail={lead.email}
          currentStatus={lead.status as LeadStatus}
          managers={managers || []}
          assignedTo={lead.assigned_to}
          quoteRequest={quoteRequest}
          paymentCondition={lead.payment_condition}
          desiredDeliveryDate={lead.desired_delivery_date}
          projectTypeTag={lead.project_type_tag}
          projectTemplateTags={projectTemplateTags}
          estimatedQuantity={lead.estimated_quantity}
          estimatedComplexity={lead.estimated_complexity}
          estimatedUrgency={lead.estimated_urgency}
          estimatedValue={lead.estimated_value}
          qualificationLevel={lead.qualification_level}
          nextId={nextId}
          ownedBy={lead.owned_by}
          commission={commission}
          ndaStatus={ndaStatusResult.status}
          ndaSignedAt={ndaStatusResult.signed_at}
          ndaSignerName={ndaStatusResult.signer_name}
        />
      </CardContent>
    </Card>
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

  // Fast parallel: nav + commission (all we need for first paint)
  const [{ data: prevLeads }, { data: nextLeads }, myCommissionData] = await Promise.all([
    supabase.from("leads").select("id").not("status", "eq", "won").not("status", "eq", "lost").gt("created_at", lead.created_at).order("created_at", { ascending: true }).limit(1),
    supabase.from("leads").select("id").not("status", "eq", "won").not("status", "eq", "lost").lt("created_at", lead.created_at).order("created_at", { ascending: false }).limit(1),
    getMyCommissionData(lead.estimated_value),
  ]);

  const prevId = prevLeads?.[0]?.id ?? null;
  const nextId = nextLeads?.[0]?.id ?? null;

  // Resolve user names for lead owner/assignee (just 2 users max)
  const leadUserIds = [lead.assigned_to, lead.owned_by].filter(Boolean) as string[];
  let userMap = new Map<string, string>();
  if (leadUserIds.length > 0) {
    const { data: users } = await supabase.from("user_profiles").select("id, email").in("id", leadUserIds);
    userMap = new Map(users?.map((u) => [u.id, u.email.split("@")[0]]) || []);
  }

  const statusColumn = LEAD_COLUMNS.find((c) => c.id === lead.status);
  const preview = myCommissionData?.preview;
  const estimate = myCommissionData?.estimate;

  return (
    <div className="mx-auto max-w-5xl">
      <LeadNav prevId={prevId} nextId={nextId} />

      {/* Commission widget — renders with first paint */}
      {preview && (
        <div className="mb-4 flex items-stretch gap-2 md:gap-3">
          <div className="flex-1 rounded-lg border border-green-200 bg-green-50 px-3 py-2.5 dark:border-green-900/50 dark:bg-green-950/30">
            <p className="text-[11px] font-medium text-green-700 dark:text-green-400">
              Mi comision · {preview.ownerName}
            </p>
            <p className="mt-0.5 text-lg font-bold tabular-nums text-green-700 dark:text-green-300">
              {preview.monthlyCommission.toFixed(2)} €
            </p>
            <p className="text-[11px] tabular-nums text-green-600/70 dark:text-green-400/60">
              {preview.monthlyBilled.toLocaleString("es-ES")} € facturado este mes
            </p>
          </div>
          {estimate && lead.status !== "won" && lead.status !== "lost" && (
            <div className="flex-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2.5 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-[11px] font-medium text-amber-700 dark:text-amber-400">
                Si cierras esta oportunidad
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-amber-700 dark:text-amber-300">
                +{estimate.commission.toFixed(2)} €
              </p>
              <p className="text-[11px] tabular-nums text-amber-600/70 dark:text-amber-400/60">
                {lead.estimated_value?.toLocaleString("es-ES")} € · {(estimate.rate * 100).toFixed(1)}%
              </p>
            </div>
          )}
          {estimate && lead.status !== "won" && lead.status !== "lost" && (
            <div className="flex-1 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 dark:border-emerald-900/50 dark:bg-emerald-950/30">
              <p className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                Total mes si cierras
              </p>
              <p className="mt-0.5 text-lg font-bold tabular-nums text-emerald-700 dark:text-emerald-300">
                {(preview.monthlyCommission + estimate.commission).toFixed(2)} €
              </p>
            </div>
          )}
        </div>
      )}

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

              <div className="flex items-center gap-2">
                <h1 className="text-xl font-bold text-card-foreground">{lead.full_name}</h1>
                {lead.project_type_tag && (
                  <Badge variant="secondary" className={tagClasses(lead.project_type_tag)}>{lead.project_type_tag}</Badge>
                )}
              </div>

              {lead.company && <p className="mt-1 text-sm text-muted-foreground">{lead.company}</p>}

              <div className="mt-4 space-y-2">
                {lead.email && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
                    <a href={`mailto:${lead.email}`} className="text-blue-600 hover:underline dark:text-blue-400">{lead.email}</a>
                  </div>
                )}
                {lead.phone && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
                    <a href={`tel:${lead.phone}`} className="text-foreground hover:underline">{lead.phone}</a>
                  </div>
                )}
                {lead.assigned_to && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
                    <span className="text-foreground">{userMap.get(lead.assigned_to) || "—"}</span>
                  </div>
                )}
                {lead.owned_by && (
                  <div className="flex items-center gap-2 text-sm">
                    <svg className="h-4 w-4 text-muted-foreground" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" /></svg>
                    <span className="text-foreground">Captado por {userMap.get(lead.owned_by) || "—"}</span>
                  </div>
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

          {/* UTM attribution */}
          <Suspense fallback={null}>
            <UtmSection leadId={id} leadSource={lead.source} />
          </Suspense>

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
        </div>

        {/* Right panel — streams independently */}
        <Suspense fallback={<ActionsSkeleton />}>
          <ActionsSection leadId={id} lead={lead} nextId={nextId} />
        </Suspense>
      </div>
    </div>
  );
}
