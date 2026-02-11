import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { syncPrinters } from "@/lib/bambu/mqtt-sync";

/**
 * POST /api/printers/sync
 *
 * Connects to Bambu Cloud MQTT, collects status from all printers,
 * and upserts results into the Supabase `printers` table.
 *
 * Uses the service role key to bypass RLS.
 */
export async function POST() {
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

    // Upsert all printer statuses (on conflict by serial_number)
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

    return NextResponse.json({ synced: results.length });
  } catch (err) {
    console.error("Printer sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
