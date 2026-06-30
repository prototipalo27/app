import { randomUUID } from "node:crypto";
import { getCalendarClient } from "./client";

const SLOT_MINUTES = 30;
const WORKDAY_START_HOUR = 11; // 11:00 local
const WORKDAY_END_HOUR = 15;   // 15:00 local (último slot empieza a las 14:30 y termina a las 15:00; ninguna reunión acaba después de las 3pm)
const SEARCH_DAYS = 7;
const SLOTS_TO_PROPOSE = 3;
/** Antelación mínima con la que se puede reservar una reunión. */
export const MIN_NOTICE_HOURS = 24;
const MIN_NOTICE_MS = MIN_NOTICE_HOURS * 60 * 60 * 1000;

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

/** Clave de día local (sirve para garantizar una sola reunión por día). */
function localDayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/**
 * Conjunto de días (clave local) en los que la diseñadora ya tiene algún
 * evento. Se usa para no proponer un día en el que ya hay una reunión: como
 * mucho una reunión por día.
 */
function busyDaysOf(busy: BusyInterval[]): Set<string> {
  const days = new Set<string>();
  for (const b of busy) {
    // Un evento puede cruzar medianoche; marcamos cada día que toca.
    const cur = new Date(b.start);
    cur.setHours(0, 0, 0, 0);
    while (cur < b.end) {
      days.add(localDayKey(cur));
      cur.setDate(cur.getDate() + 1);
    }
  }
  return days;
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

  // No se puede reservar con menos de 24h de antelación: arrancamos la
  // búsqueda desde ese mínimo.
  const minBookable = new Date(from.getTime() + MIN_NOTICE_MS);
  const timeMin = startOfNextWorkingDay(minBookable);
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

  // Días en los que la diseñadora ya tiene algún evento: no se proponen,
  // garantizando como mucho una reunión por día.
  const busyDays = busyDaysOf(busy);

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

    const dayKey = localDayKey(slotStart);

    // Si ya hay algún evento ese día, saltamos el día entero.
    if (busyDays.has(dayKey)) {
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(WORKDAY_START_HOUR, 0, 0, 0);
      continue;
    }

    if (
      !overlapsBusy(slotStart, slotEnd, busy) &&
      !usedDays.has(dayKey) &&
      slotStart >= minBookable
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
 * Revalida en el momento de reservar que un slot sigue siendo válido:
 *  - con al menos 24h de antelación, y
 *  - en un día en el que la diseñadora no tenga ya ninguna reunión
 *    (como mucho una reunión por día).
 *
 * Necesario porque los slots se proponen con antelación y, entre la propuesta
 * y la confirmación, el tiempo pasa u otro cliente puede haber reservado ese
 * mismo día.
 */
export async function checkKickoffSlotBookable(
  calendarId: string,
  slotIso: string,
  options: { now?: Date } = {},
): Promise<{ ok: true } | { ok: false; error: string }> {
  const now = options.now ?? new Date();
  const slotStart = new Date(slotIso);

  if (Number.isNaN(slotStart.getTime())) {
    return { ok: false, error: "Ese hueco ya no está disponible" };
  }

  if (slotStart.getTime() < now.getTime() + MIN_NOTICE_MS) {
    return {
      ok: false,
      error: `Las reuniones deben reservarse con al menos ${MIN_NOTICE_HOURS}h de antelación. Elige otro hueco.`,
    };
  }

  // Ventana del día completo del slot (hora local del servidor).
  const dayStart = new Date(slotStart);
  dayStart.setHours(0, 0, 0, 0);
  const dayEnd = new Date(dayStart);
  dayEnd.setDate(dayEnd.getDate() + 1);

  const calendar = getCalendarClient({ impersonate: calendarId });
  const fb = await calendar.freebusy.query({
    requestBody: {
      timeMin: dayStart.toISOString(),
      timeMax: dayEnd.toISOString(),
      items: [{ id: calendarId }],
    },
  });

  const busy = fb.data.calendars?.[calendarId]?.busy ?? [];
  if (busy.length > 0) {
    return {
      ok: false,
      error: "Ese día ya está ocupado. Elige otro hueco.",
    };
  }

  return { ok: true };
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
