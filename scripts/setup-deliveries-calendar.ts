// Script de un solo uso: crea el calendario "Prototipalo Entregas" usando
// la service account como propietaria. Así esquivamos las restricciones
// de Workspace para sharing externo de calendarios secundarios.
//
// Uso: GOOGLE_SERVICE_ACCOUNT_EMAIL=... GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY=... \
//      OWNER_EMAIL=manu@prototipalo.com npx tsx scripts/setup-deliveries-calendar.ts
//
// Tras correrlo, copia el Calendar ID que imprime y guárdalo en .env.local
// y en Vercel como DELIVERIES_CALENDAR_ID.

import { google } from "googleapis";
import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

// Carga .env.local manualmente — tsx no lo hace por defecto y este repo
// no usa dotenv como dependencia.
function loadEnvLocal() {
  const envPath = resolve(process.cwd(), ".env.local");
  if (!existsSync(envPath)) return;
  const content = readFileSync(envPath, "utf8");
  for (const rawLine of content.split("\n")) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip surrounding quotes (con o sin escapes)
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) {
      process.env[key] = value;
    }
  }
}

loadEnvLocal();

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

async function main() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;
  const ownerEmail = process.env.OWNER_EMAIL;

  if (!email || !privateKey) {
    throw new Error("Faltan GOOGLE_SERVICE_ACCOUNT_EMAIL o GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY");
  }
  if (!ownerEmail) {
    throw new Error("Falta OWNER_EMAIL (la cuenta humana que verá el calendario)");
  }

  const auth = new google.auth.JWT({
    email,
    key: formatPrivateKey(privateKey),
    scopes: ["https://www.googleapis.com/auth/calendar"],
  });

  const calendar = google.calendar({ version: "v3", auth });

  console.log("→ Creando calendario 'Prototipalo Entregas'...");
  const created = await calendar.calendars.insert({
    requestBody: {
      summary: "Prototipalo Entregas",
      description: "Fechas de entrega de proyectos confirmados. Sincronizado desde la app.",
      timeZone: "Europe/Madrid",
    },
  });

  const calendarId = created.data.id;
  if (!calendarId) throw new Error("Calendar API no devolvió ID");
  console.log(`✓ Calendario creado: ${calendarId}`);

  console.log(`→ Compartiendo con ${ownerEmail} (lectura)...`);
  await calendar.acl.insert({
    calendarId,
    requestBody: {
      role: "reader",
      scope: { type: "user", value: ownerEmail },
    },
  });
  console.log("✓ Compartido.");

  console.log("\n──────────────────────────────────────────");
  console.log("DELIVERIES_CALENDAR_ID=" + calendarId);
  console.log("──────────────────────────────────────────");
  console.log("\nGuárdalo en .env.local y en Vercel.");
  console.log(`Para verlo en tu Google Calendar: calendar.google.com → "+" → "Suscribirse al calendario" → pega el ID.`);
}

main().catch((err) => {
  console.error("Error:", err);
  process.exit(1);
});
