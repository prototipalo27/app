import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncPrinters } from "@/lib/bambu/mqtt-sync";
import { sendPushToAll } from "@/lib/push-notifications/server";
import { recordPrintingTime } from "@/lib/printer-stats";
import { autoCompleteByKeyword } from "@/lib/auto-complete-jobs";
import { autoTrackPrintJobs } from "@/lib/auto-track-jobs";

/**
 * Shared sync logic used by both GET (Vercel Cron) and POST (manual trigger).
 */
async function runSync() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  try {
    const results = await syncPrinters();

    if (results.length === 0) {
      return NextResponse.json({ synced: 0, message: "No printers found" });
    }

    // Read previous states BEFORE upserting new data
    const { data: prevStates } = await supabase
      .from("printers")
      .select("serial_number, print_error, gcode_state, current_file");

    const prevErrorMap = new Map(
      (prevStates ?? []).map((p) => [p.serial_number, p.print_error ?? 0])
    );

    const { error } = await supabase.from("printers").upsert(
      results.map((r) => ({
        serial_number: r.serial_number,
        name: r.name,
        model: r.model,
        online: r.online,
        mqtt_connected: r.mqtt_connected,
        gcode_state: r.gcode_state,
        print_percent: r.print_percent,
        remaining_minutes: r.remaining_minutes,
        current_file: r.current_file,
        layer_current: r.layer_current,
        layer_total: r.layer_total,
        nozzle_temp: r.nozzle_temp,
        nozzle_target: r.nozzle_target,
        bed_temp: r.bed_temp,
        bed_target: r.bed_target,
        chamber_temp: r.chamber_temp,
        speed_level: r.speed_level,
        fan_speed: r.fan_speed,
        print_error: r.print_error,
        raw_status: r.raw_status,
        last_sync_at: r.last_sync_at,
      })),
      { onConflict: "serial_number" }
    );

    if (error) {
      console.error("Supabase upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record printing time for stats (5min = 300s sync interval)
    recordPrintingTime(supabase, results, 300).catch((err) =>
      console.error("Failed to record printing time:", err)
    );

    // Auto-track print jobs: RUNNING→printing, FINISH→done
    autoTrackPrintJobs(
      supabase,
      (prevStates ?? []).map((p) => ({
        serial_number: p.serial_number,
        gcode_state: p.gcode_state,
        current_file: p.current_file,
      })),
      results.map((r) => ({
        serial_number: r.serial_number,
        gcode_state: r.gcode_state,
        current_file: r.current_file,
      }))
    ).catch((err) =>
      console.error("Failed to auto-track jobs:", err)
    );

    // Auto-complete print jobs by file keyword
    autoCompleteByKeyword(
      supabase,
      (prevStates ?? []).map((p) => ({
        serial_number: p.serial_number,
        gcode_state: p.gcode_state,
        current_file: p.current_file,
      })),
      results.map((r) => ({
        serial_number: r.serial_number,
        gcode_state: r.gcode_state,
      }))
    ).catch((err) =>
      console.error("Failed to auto-complete jobs:", err)
    );

    // Send push notifications only for NEW printer errors
    // (error code that wasn't present in the previous sync)
    for (const printer of results) {
      if (!printer.print_error) continue;
      const prevError = prevErrorMap.get(printer.serial_number) ?? 0;
      if (prevError !== printer.print_error) {
        sendPushToAll({
          title: "Alerta impresora",
          body: `${printer.name}: error de impresion`,
          url: "/dashboard/printers",
        }).catch(() => {});
      }
    }

    return NextResponse.json({ synced: results.length });
  } catch (err) {
    console.error("Printer sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/**
 * GET /api/printers/sync
 *
 * Called by Vercel Cron every 5 minutes.
 * Protected by CRON_SECRET to prevent unauthorized access.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  return runSync();
}

/**
 * POST /api/printers/sync
 *
 * Manual trigger from the dashboard (requires authenticated user).
 */
export async function POST() {
  return runSync();
}
