// Helpers de cálculo en días laborales (lun-vie, excluyendo festivos).
// Se usan para el calendario de entregas: dada una fecha de entrega y N
// horas laborales de margen, computamos el día en el que hay que empezar.
//
// "48h laborales" = 48 horas naturales contadas SOLO en días laborales.
// Es decir: 24h = 1 día lab., 48h = 2 días lab. Si entrega es lunes y
// margen 48h → empezar jueves (lunes - 2 días lab. saltando finde).

const HOURS_PER_DAY = 24;

function toDateOnly(value: string | Date): Date {
  if (value instanceof Date) {
    return new Date(value.getFullYear(), value.getMonth(), value.getDate());
  }
  // YYYY-MM-DD strings: parseamos en local para evitar saltos por TZ.
  const [y, m, d] = value.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

function toIsoDate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

function isWeekend(date: Date): boolean {
  const day = date.getDay();
  return day === 0 || day === 6;
}

/** Convierte horas laborales en días laborales completos (redondeo arriba). */
export function leadHoursToDays(hours: number): number {
  if (!Number.isFinite(hours) || hours <= 0) return 0;
  return Math.ceil(hours / HOURS_PER_DAY);
}

/**
 * Devuelve la fecha (YYYY-MM-DD) resultante de restar `days` días laborales
 * a `from`, saltando fines de semana y festivos. El propio día de entrega
 * NO cuenta — si days=1 y entrega es viernes, devuelve jueves.
 */
export function subtractBusinessDays(
  from: string | Date,
  days: number,
  holidays: Set<string> = new Set(),
): string {
  const cursor = toDateOnly(from);
  let remaining = days;
  while (remaining > 0) {
    cursor.setDate(cursor.getDate() - 1);
    const iso = toIsoDate(cursor);
    if (isWeekend(cursor) || holidays.has(iso)) continue;
    remaining--;
  }
  return toIsoDate(cursor);
}

/** Variante por horas: redondea a días con `leadHoursToDays`. */
export function subtractBusinessHours(
  from: string | Date,
  hours: number,
  holidays: Set<string> = new Set(),
): string {
  return subtractBusinessDays(from, leadHoursToDays(hours), holidays);
}
