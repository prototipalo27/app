import { randomUUID } from "node:crypto";
import { getCalendarClient } from "./client";

const SLOT_MINUTES = 30;
const WORKDAY_START_HOUR = 11; // 11:00 local
const WORKDAY_END_HOUR = 18;   // 18:00 local (último slot empieza a las 17:30)
const SEARCH_DAYS = 7;
const SLOTS_TO_PROPOSE = 3;

/** Email/calendarId de la diseñadora por defecto (Isabella). */
export function getDefaultDesignerCalendarId(): string | null {
  return process.env.DESIGNER_KICKOFF_CALENDAR_ID || null;
}

/** Nombre legible de la diseñadora — sólo para mostrar al cliente. */
export function getDefaultDesignerName(): string {
  return process.env.DESIGNER_KICKOFF_NAME || "Isabella";
}

interface BusyInterval {
  start: Date;
  end: Date;
}

function startOfNextWorkingDay(from: Date): Date {
  const d = new Date(from);
  d.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  // Si ya es laboralmente hoy y aún hay día por delante, empezamos hoy +1h
  if (
    from.getHours() < WORKDAY_END_HOUR &&
    from.getDay() !== 0 &&
    from.getDay() !== 6
  ) {
    const candidate = new Date(from);
    candidate.setMinutes(0, 0, 0);
    candidate.setHours(Math.max(WORKDAY_START_HOUR, from.getHours() + 1));
    if (candidate.getHours() < WORKDAY_END_HOUR) return candidate;
  }
  // Si no, saltamos al siguiente día laboral
  do {
    d.setDate(d.getDate() + 1);
    d.setHours(WORKDAY_START_HOUR, 0, 0, 0);
  } while (d.getDay() === 0 || d.getDay() === 6);
  return d;
}

function overlapsBusy(start: Date, end: Date, busy: BusyInterval[]): boolean {
  for (const b of busy) {
    if (start < b.end && end > b.start) return true;
  }
  return false;
}

/**
 * Devuelve hasta `count` slots de 30 min disponibles en el calendario del
 * designer en los próximos `SEARCH_DAYS` días laborables. Si no encuentra
 * suficientes, devuelve los que haya. Lanza si el servicio falla.
 */
export async function getDesignerAvailability(
  calendarId: string,
  options: { count?: number; from?: Date } = {},
): Promise<string[]> {
  const count = options.count ?? SLOTS_TO_PROPOSE;
  const from = options.from ?? new Date();
  const calendar = getCalendarClient({ impersonate: calendarId });

  const timeMin = startOfNextWorkingDay(from);
  const timeMax = new Date(timeMin);
  timeMax.setDate(timeMax.getDate() + SEARCH_DAYS);

  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: timeMin.toISOString(),
      timeMax: timeMax.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const rawBusy = fb.data.calendars?.[calendarId]?.busy ?? [];
  const busy: BusyInterval[] = rawBusy
    .filter((b) => b.start && b.end)
    .map((b) => ({ start: new Date(b.start!), end: new Date(b.end!) }));

  const slots: string[] = [];
  const usedDays = new Set<string>();

  const cursor = new Date(timeMin);
  while (cursor < timeMax && slots.length < count) {
    const dow = cursor.getDay();
    if (dow === 0 || dow === 6) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKDAY_START_HOUR, 0, 0, 0);
      continue;
    }

    if (cursor.getHours() >= WORKDAY_END_HOUR) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKDAY_START_HOUR, 0, 0, 0);
      continue;
    }

    const slotStart = new Date(cursor);
    const slotEnd = new Date(cursor);
    slotEnd.setMinutes(slotEnd.getMinutes() + SLOT_MINUTES);

    const dayKey = `${slotStart.getFullYear()}-${slotStart.getMonth()}-${slotStart.getDate()}`;

    if (
      !overlapsBusy(slotStart, slotEnd, busy) &&
      !usedDays.has(dayKey) &&
      slotStart > new Date()
    ) {
      slots.push(slotStart.toISOString());
      usedDays.add(dayKey);
      // Pasamos al siguiente día — queremos diversidad
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKDAY_START_HOUR, 0, 0, 0);
      continue;
    }

    cursor.setMinutes(cursor.getMinutes() + SLOT_MINUTES);
  }

  return slots;
}

/**
 * Crea el evento de kickoff en el calendario de la diseñadora con un Google
 * Meet adjunto y al cliente como attendee (recibe el invite por email).
 * Devuelve event_id + meeting_link.
 */
export async function createKickoffEvent(input: {
  calendarId: string;
  designerName: string;
  startISO: string;
  durationMinutes?: number;
  projectName: string;
  clientName: string;
  clientEmail: string;
  projectId: string;
}): Promise<{ eventId: string; meetingLink: string | null }> {
  const calendar = getCalendarClient({ impersonate: input.calendarId });
  const start = new Date(input.startISO);
  const end = new Date(start);
  end.setMinutes(end.getMinutes() + (input.durationMinutes ?? SLOT_MINUTES));

  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    process.env.NEXT_PUBLIC_BASE_URL ||
    "https://app.prototipalo.es";

  const res = await calendar.events.insert({
    calendarId: input.calendarId,
    conferenceDataVersion: 1,
    sendUpdates: "all",
    requestBody: {
      summary: `Kickoff — ${input.clientName || input.projectName}`,
      description: [
        `Reunión inicial con ${input.designerName}.`,
        "",
        `Cliente: ${input.clientName}`,
        `Proyecto: ${input.projectName}`,
        `Ficha interna: ${baseUrl}/dashboard/projects/${input.projectId}`,
      ].join("\n"),
      start: { dateTime: start.toISOString() },
      end: { dateTime: end.toISOString() },
      attendees: input.clientEmail
        ? [{ email: input.clientEmail, displayName: input.clientName }]
        : undefined,
      conferenceData: {
        createRequest: {
          requestId: randomUUID(),
          conferenceSolutionKey: { type: "hangoutsMeet" },
        },
      },
      extendedProperties: {
        private: { project_id: input.projectId, kind: "kickoff" },
      },
    },
  });

  const meetingLink =
    res.data.hangoutLink ||
    res.data.conferenceData?.entryPoints?.find((e) => e.entryPointType === "video")?.uri ||
    null;

  return {
    eventId: res.data.id!,
    meetingLink,
  };
}

export function generateKickoffToken(): string {
  return randomUUID().replace(/-/g, "");
}
