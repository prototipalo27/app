import type { MrwTrackingEvent } from "./types";

export type MrwDerivedStatus = "pending" | "in_transit" | "delivered" | "incident";

export interface DerivedMrwStatus {
  status: MrwDerivedStatus;
  deliveredAt: string | null;
}

// MRW returns Fecha as "DD/MM/YYYY HH:mm:ss" or ISO. Normalize to ISO so it
// round-trips through Postgres timestamptz.
function parseMrwDate(raw: string): string | null {
  if (!raw) return null;
  const iso = new Date(raw);
  if (!isNaN(iso.getTime())) return iso.toISOString();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})(?:\s+(\d{2}):(\d{2})(?::(\d{2}))?)?$/);
  if (!m) return null;
  const [, dd, mm, yyyy, hh = "00", mi = "00", ss = "00"] = m;
  const d = new Date(`${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`);
  return isNaN(d.getTime()) ? null : d.toISOString();
}

export function deriveMrwStatus(events: MrwTrackingEvent[]): DerivedMrwStatus {
  if (!events || events.length === 0) return { status: "pending", deliveredAt: null };

  const delivered = events.find((e) => /entregad/i.test(e.description));
  if (delivered) {
    return { status: "delivered", deliveredAt: parseMrwDate(delivered.date) };
  }

  if (events.some((e) => /incidencia|devuelt|rechaz/i.test(e.description))) {
    return { status: "incident", deliveredAt: null };
  }

  if (events.some((e) => /reparto|tr[áa]nsito|franquicia|recogid/i.test(e.description))) {
    return { status: "in_transit", deliveredAt: null };
  }

  return { status: "pending", deliveredAt: null };
}
