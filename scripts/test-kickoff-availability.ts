// Smoke test: comprueba que la service account puede leer la agenda de
// Isabella y proponer huecos para el kickoff.
//
// Uso: npx tsx scripts/test-kickoff-availability.ts

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
    if (!process.env[k]) {
      process.env[k] = v.replace(/^"|"$/g, "");
    }
  }
}

loadEnvLocal();

async function main() {
  const calendarId = process.env.DESIGNER_KICKOFF_CALENDAR_ID;
  if (!calendarId) {
    console.error("❌ DESIGNER_KICKOFF_CALENDAR_ID no está en .env.local");
    process.exit(1);
  }

  console.log(`📅 Probando acceso a: ${calendarId}`);

  const { getDesignerAvailability } = await import("../src/lib/google-calendar/kickoff");

  try {
    const slots = await getDesignerAvailability(calendarId);
    if (slots.length === 0) {
      console.warn("⚠️  Acceso OK pero 0 huecos propuestos (¿agenda llena los próximos 7 días?)");
    } else {
      console.log(`✅ ${slots.length} huecos disponibles:`);
      for (const iso of slots) {
        const d = new Date(iso);
        const local = new Intl.DateTimeFormat("es-ES", {
          timeZone: "Europe/Madrid",
          weekday: "long",
          day: "numeric",
          month: "long",
          hour: "2-digit",
          minute: "2-digit",
        }).format(d);
        console.log(`   • ${local}`);
      }
    }
  } catch (err) {
    console.error("❌ Falló la consulta:", err);
    process.exit(1);
  }
}

main();
