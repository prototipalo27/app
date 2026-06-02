import { google, type calendar_v3 } from "googleapis";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import { subtractBusinessHours, leadHoursToDays } from "@/lib/business-days";

const CALENDAR_SCOPE = "https://www.googleapis.com/auth/calendar";

function createServiceRoleClient() {
  return createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );
}

function formatPrivateKey(raw: string): string {
  let key = raw
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const lines = key.match(/.{1,64}/g) ?? [];
  return [
    "-----BEGIN PRIVATE KEY-----",
    ...lines,
    "-----END PRIVATE KEY-----",
    "",
  ].join("\n");
}

export function getDeliveriesCalendarConfig(): { calendarId: string } | null {
  const calendarId = process.env.DELIVERIES_CALENDAR_ID;
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  if (!calendarId || !email || !privateKey) return null;
  return { calendarId };
}

export function getCalendarClient(options?: { impersonate?: string }): calendar_v3.Calendar {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY!;
  const auth = new google.auth.JWT({
    email,
    key: formatPrivateKey(privateKey),
    scopes: [CALENDAR_SCOPE],
    subject: options?.impersonate,
  });
  return google.calendar({ version: "v3", auth });
}

interface ProjectForSync {
  id: string;
  name: string;
  client_name: string | null;
  deadline: string | null;
  status: string;
  project_type: string | null;
}

/** ¿Este proyecto debe tener evento en el calendario? */
function shouldHaveEvent(project: ProjectForSync): boolean {
  if (!project.deadline) return false;
  if (project.project_type !== "confirmed") return false;
  if (project.status === "delivered") return false;
  return true;
}

function buildTitle(project: ProjectForSync, kind: "prep" | "delivery"): string {
  const label = project.client_name || project.name;
  return kind === "delivery" ? `Entrega: ${label}` : `Empezar: ${label}`;
}

function buildDescription(project: ProjectForSync, leadHours: number, kind: "prep" | "delivery"): string {
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || "https://app.prototipalo.es";
  const link = `${baseUrl}/dashboard/projects/${project.id}`;
  const lines = [
    project.name && project.client_name ? `Proyecto: ${project.name}` : null,
    `Estado: ${project.status}`,
    kind === "prep" ? `Margen: ${leadHours}h laborales antes de la entrega` : null,
    "",
    `Ficha: ${link}`,
  ].filter(Boolean);
  return lines.join("\n");
}

async function getLeadHours(): Promise<number> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("app_metadata")
    .select("value")
    .eq("key", "delivery_lead_hours")
    .single();
  const hours = Number(data?.value ?? 48);
  return Number.isFinite(hours) && hours >= 0 ? hours : 48;
}

async function getHolidaySet(year: number): Promise<Set<string>> {
  const supabase = createServiceRoleClient();
  const { data } = await supabase
    .from("holidays")
    .select("date")
    .in("year", [year, year + 1]);
  return new Set((data ?? []).map((h) => h.date));
}

/**
 * Crea/actualiza/elimina los eventos del calendario para un proyecto en
 * función de su estado actual. Idempotente. No throwea — registra el
 * error pero deja la app funcionando aunque la sync falle.
 */
export async function syncProjectDeliveryEvents(projectId: string): Promise<void> {
  const config = getDeliveriesCalendarConfig();
  if (!config) return; // Feature flag: sin env vars, no-op silencioso

  const supabase = createServiceRoleClient();

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, client_name, deadline, status, project_type")
    .eq("id", projectId)
    .single();

  if (error || !project) {
    console.error("[calendar-sync] project not found", projectId, error);
    return;
  }

  const { data: existing } = await supabase
    .from("project_calendar_events")
    .select("delivery_event_id, prep_event_id, calendar_id")
    .eq("project_id", projectId)
    .maybeSingle();

  const calendar = getCalendarClient();
  const calendarId = config.calendarId;

  // Si el proyecto ya no debe tener eventos, los borramos
  if (!shouldHaveEvent(project)) {
    if (existing) {
      await deleteEventSafe(calendar, calendarId, existing.delivery_event_id);
      await deleteEventSafe(calendar, calendarId, existing.prep_event_id);
      await supabase.from("project_calendar_events").delete().eq("project_id", projectId);
    }
    return;
  }

  // Calculamos prep_date a partir de lead_hours + festivos
  const leadHours = await getLeadHours();
  const deliveryDate = project.deadline!;
  const year = new Date(deliveryDate + "T00:00:00").getFullYear();
  const holidays = await getHolidaySet(year);
  const prepDate = leadHours > 0
    ? subtractBusinessHours(deliveryDate, leadHours, holidays)
    : null;

  const deliveryRequest: calendar_v3.Schema$Event = {
    summary: buildTitle(project, "delivery"),
    description: buildDescription(project, leadHours, "delivery"),
    start: { date: deliveryDate },
    end: { date: addOneDay(deliveryDate) },
    extendedProperties: {
      private: { project_id: project.id, kind: "delivery" },
    },
  };

  const prepRequest: calendar_v3.Schema$Event | null = prepDate
    ? {
        summary: buildTitle(project, "prep"),
        description: buildDescription(project, leadHours, "prep"),
        start: { date: prepDate },
        end: { date: addOneDay(prepDate) },
        extendedProperties: {
          private: { project_id: project.id, kind: "prep" },
        },
      }
    : null;

  try {
    const deliveryEventId = await upsertEvent(
      calendar,
      calendarId,
      existing?.delivery_event_id ?? null,
      deliveryRequest,
    );
    const prepEventId = prepRequest
      ? await upsertEvent(calendar, calendarId, existing?.prep_event_id ?? null, prepRequest)
      : (await deleteEventSafe(calendar, calendarId, existing?.prep_event_id), null);

    await supabase
      .from("project_calendar_events")
      .upsert({
        project_id: projectId,
        calendar_id: calendarId,
        delivery_event_id: deliveryEventId,
        prep_event_id: prepEventId,
        synced_at: new Date().toISOString(),
      });
  } catch (err) {
    console.error("[calendar-sync] failed for project", projectId, err);
  }
}

/** Borra los eventos de un proyecto del calendario y la fila local. */
export async function removeProjectDeliveryEvents(projectId: string): Promise<void> {
  const config = getDeliveriesCalendarConfig();
  if (!config) return;

  const supabase = createServiceRoleClient();
  const { data: existing } = await supabase
    .from("project_calendar_events")
    .select("delivery_event_id, prep_event_id, calendar_id")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!existing) return;

  const calendar = getCalendarClient();
  await deleteEventSafe(calendar, config.calendarId, existing.delivery_event_id);
  await deleteEventSafe(calendar, config.calendarId, existing.prep_event_id);
  await supabase.from("project_calendar_events").delete().eq("project_id", projectId);
}

async function upsertEvent(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string | null,
  body: calendar_v3.Schema$Event,
): Promise<string> {
  if (eventId) {
    try {
      const res = await calendar.events.update({ calendarId, eventId, requestBody: body });
      return res.data.id!;
    } catch (err) {
      // Si el evento se borró a mano en el calendario, recreamos
      if (isNotFound(err)) {
        const res = await calendar.events.insert({ calendarId, requestBody: body });
        return res.data.id!;
      }
      throw err;
    }
  }
  const res = await calendar.events.insert({ calendarId, requestBody: body });
  return res.data.id!;
}

async function deleteEventSafe(
  calendar: calendar_v3.Calendar,
  calendarId: string,
  eventId: string | null | undefined,
): Promise<void> {
  if (!eventId) return;
  try {
    await calendar.events.delete({ calendarId, eventId });
  } catch (err) {
    // 404 / 410 = ya no existe, ignoramos
    if (!isNotFound(err) && !isGone(err)) throw err;
  }
}

function isNotFound(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 404;
}

function isGone(err: unknown): boolean {
  return typeof err === "object" && err !== null && "code" in err && (err as { code: number }).code === 410;
}

function addOneDay(date: string): string {
  const [y, m, d] = date.split("-").map(Number);
  const next = new Date(y, m - 1, d + 1);
  const yy = next.getFullYear();
  const mm = String(next.getMonth() + 1).padStart(2, "0");
  const dd = String(next.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

// Re-exportamos para uso externo (tests, scripts de backfill)
export { leadHoursToDays };
