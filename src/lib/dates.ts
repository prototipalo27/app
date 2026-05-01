// Helpers de formateo de fechas en zona horaria de Madrid.
//
// El servidor (Vercel) corre con TZ=Europe/Madrid, así que `new Date()` y
// los formatters server-side ya devuelven Madrid. En el cliente, el browser
// usa su propia tz por defecto — por eso los helpers fijan `timeZone`
// explícitamente, así una fecha se ve igual independientemente de dónde
// se renderice.

const TZ = "Europe/Madrid";
const LOCALE = "es-ES";

type DateInput = string | number | Date | null | undefined;

function toDate(value: DateInput): Date | null {
  if (value === null || value === undefined || value === "") return null;
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** "01/05/2026" — formato corto numérico. */
export function formatDate(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, { timeZone: TZ });
}

/** "1 may 2026" — día + mes corto + año completo. */
export function formatDateMedium(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: TZ,
  });
}

/** "1 mayo 2026" — día + mes largo + año. */
export function formatDateLong(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

/** "1 may" — sin año, útil para listas compactas. */
export function formatDayMonth(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    day: "numeric",
    month: "short",
    timeZone: TZ,
  });
}

/** "may 26" — mes corto + año a 2 dígitos. */
export function formatMonthYearShort(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    month: "short",
    year: "2-digit",
    timeZone: TZ,
  });
}

/** "mayo 2026" — mes largo + año. */
export function formatMonthYearLong(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleDateString(LOCALE, {
    month: "long",
    year: "numeric",
    timeZone: TZ,
  });
}

/** "1 may, 15:30" — sin año, útil para timelines / actividad reciente. */
export function formatDayMonthTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "1 may 2026, 15:30". */
export function formatDateTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleString(LOCALE, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/** "15:30". */
export function formatTime(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "—";
  return d.toLocaleTimeString(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: TZ,
  });
}

/**
 * Convierte un ISO a "YYYY-MM-DDTHH:MM" en Madrid local, formato apto para
 * un <input type="datetime-local">.
 */
export function toMadridDateTimeInput(value: DateInput): string {
  const d = toDate(value);
  if (!d) return "";
  // sv-SE da YYYY-MM-DD HH:MM:SS, ideal para parsear.
  const parts = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(d);
  return parts.replace(" ", "T");
}

/**
 * Toma un valor "YYYY-MM-DDTHH:MM" venido de un <input type="datetime-local">
 * y lo convierte a un ISO UTC asumiendo que el usuario lo escribió en hora
 * Madrid. Útil al guardar en Postgres `timestamptz`.
 */
export function madridInputToIso(localValue: string | null | undefined): string | null {
  if (!localValue) return null;
  const match = localValue.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!match) return null;
  const [, y, m, d, h, mi] = match;
  // Construye el instante en UTC y luego ajusta restando el offset de Madrid
  // para esa fecha (que cambia con DST).
  const utcCandidate = new Date(Date.UTC(+y, +m - 1, +d, +h, +mi));
  const madridLabel = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).format(utcCandidate);
  // madridLabel = "YYYY-MM-DD HH:MM:SS" como se vería en Madrid si el reloj
  // marcara `utcCandidate`. La diferencia entre ese label y el input es el
  // offset que hay que restar.
  const [mDate, mTime] = madridLabel.split(" ");
  const [my, mm, md] = mDate.split("-").map(Number);
  const [mh, mmi] = mTime.split(":").map(Number);
  const madridAsUtc = Date.UTC(my, mm - 1, md, mh, mmi);
  const offsetMs = madridAsUtc - utcCandidate.getTime();
  return new Date(utcCandidate.getTime() - offsetMs).toISOString();
}
