// Resetea el kickoff de un proyecto de prueba para volver a probarlo:
// borra el evento de Google Calendar y limpia los campos confirmed_*.
//
// Uso: npx tsx scripts/reset-kickoff-test.ts <kickoff_token>

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
    if (!process.env[k]) process.env[k] = v.replace(/^"|"$/g, "").replace(/\\n$/, "").trim();
  }
}

loadEnvLocal();

async function main() {
  const token = process.argv[2];
  if (!token) {
    console.error("Uso: npx tsx scripts/reset-kickoff-test.ts <kickoff_token>");
    process.exit(1);
  }

  const { createClient } = await import("@supabase/supabase-js");
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
  );

  const { data: project, error } = await supabase
    .from("projects")
    .select("id, name, kickoff_event_id, kickoff_confirmed_slot")
    .eq("kickoff_token", token)
    .maybeSingle();
  if (error || !project) {
    console.error("No encuentro el proyecto:", error);
    process.exit(1);
  }

  console.log(`📋 Proyecto: ${project.name} (id ${project.id})`);
  console.log(`   Slot confirmado: ${project.kickoff_confirmed_slot}`);
  console.log(`   Event ID: ${project.kickoff_event_id}`);

  const calendarId = process.env.DESIGNER_KICKOFF_CALENDAR_ID!;
  if (project.kickoff_event_id) {
    const { getCalendarClient } = await import("../src/lib/google-calendar/client");
    const calendar = getCalendarClient({ impersonate: calendarId });
    try {
      await calendar.events.delete({
        calendarId,
        eventId: project.kickoff_event_id,
        sendUpdates: "all", // notifica al cliente que se cancela
      });
      console.log("🗑️  Evento borrado del calendar de Isabella.");
    } catch (err: unknown) {
      const e = err as { code?: number; message?: string };
      if (e.code === 404 || e.code === 410) {
        console.log("ℹ️  El evento ya no existía.");
      } else {
        console.error("⚠️  Error borrando evento:", e.message ?? err);
      }
    }
  }

  const { error: updErr } = await supabase
    .from("projects")
    .update({
      kickoff_confirmed_at: null,
      kickoff_confirmed_slot: null,
      kickoff_event_id: null,
      kickoff_meeting_link: null,
    })
    .eq("id", project.id);
  if (updErr) {
    console.error("Falló el reset en BD:", updErr);
    process.exit(1);
  }

  console.log("✅ Reset completo. Ya puedes volver a confirmar un slot.");
}

main();
