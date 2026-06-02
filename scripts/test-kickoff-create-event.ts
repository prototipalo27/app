// Smoke test: crea un evento de prueba en el calendario de Isabella CON
// attendee (lo que requiere DWD funcionando) y lo borra al instante.
//
// Uso: npx tsx scripts/test-kickoff-create-event.ts

import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const line of content.split("\n")) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (!m) continue;
    const [, k, v] = m;
    if (!process.env[k]) process.env[k] = v.replace(/^"|"$/g, "");
  }
}

loadEnvLocal();

async function main() {
  const calendarId = process.env.DESIGNER_KICKOFF_CALENDAR_ID;
  if (!calendarId) {
    console.error("❌ Falta DESIGNER_KICKOFF_CALENDAR_ID");
    process.exit(1);
  }

  const { getCalendarClient } = await import("../src/lib/google-calendar/client");
  const calendar = getCalendarClient({ impersonate: calendarId });

  // Evento dentro de 5 minutos para no interferir con nada real.
  const start = new Date(Date.now() + 5 * 60_000);
  const end = new Date(start.getTime() + 30 * 60_000);

  console.log(`📝 Creando evento de prueba con attendee...`);

  try {
    const res = await calendar.events.insert({
      calendarId,
      sendUpdates: "none", // ⚠️ no spamear a manu mientras probamos
      requestBody: {
        summary: "[TEST DWD] Borrar inmediatamente",
        description: "Smoke test de domain-wide delegation — se borra solo.",
        start: { dateTime: start.toISOString() },
        end: { dateTime: end.toISOString() },
        attendees: [{ email: "manu@prototipalo.com", displayName: "Test" }],
      },
    });

    const eventId = res.data.id!;
    console.log(`✅ Evento creado con attendee: ${eventId}`);
    console.log(`   Attendees: ${(res.data.attendees ?? []).map((a) => a.email).join(", ") || "(ninguno)"}`);

    await calendar.events.delete({ calendarId, eventId });
    console.log(`🗑️  Evento borrado. DWD funciona end-to-end.`);
  } catch (err: unknown) {
    const e = err as { message?: string; code?: number };
    console.error(`❌ Falló: ${e.message ?? err}`);
    if (e.code === 403) {
      console.error("   → DWD no propaga aún (puede tardar minutos), o el scope/Client ID no coincide.");
    }
    process.exit(1);
  }
}

main();
