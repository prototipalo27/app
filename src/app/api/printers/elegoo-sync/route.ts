import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll } from "@/lib/push-notifications/server";
import { recordPrintingTime } from "@/lib/printer-stats";

interface ElegooPrinterPayload {
  serial_number: string;
  name: string;
  model: string | null;
  online: boolean;
  gcode_state: string | null;
  print_percent: number | null;
  remaining_minutes: number | null;
  current_file: string | null;
  layer_current: number | null;
  layer_total: number | null;
  nozzle_temp: number | null;
  nozzle_target: number | null;
  bed_temp: number | null;
  bed_target: number | null;
  chamber_temp: number | null;
  speed_level: number | null;
  fan_speed: number | null;
  print_error: number | null;
}

/**
 * POST /api/printers/elegoo-sync
 *
 * Called by the Raspberry Pi hub every 30-60s.
 * Receives status of all connected Elegoo printers and upserts into the printers table.
 */
export async function POST(request: NextRequest) {
  // Authenticate the RPi hub
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.ELEGOO_HUB_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    return NextResponse.json(
      { error: "Missing Supabase service role configuration" },
      { status: 500 }
    );
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let body: { printers: ElegooPrinterPayload[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!Array.isArray(body.printers) || body.printers.length === 0) {
    return NextResponse.json({ error: "No printers in payload" }, { status: 400 });
  }

  try {
    const now = new Date().toISOString();

    // Read previous error states BEFORE upserting
    const serials = body.printers.map((p) => p.serial_number);
    const { data: prevStates } = await supabase
      .from("printers")
      .select("serial_number, print_error")
      .in("serial_number", serials);

    const prevErrorMap = new Map(
      (prevStates ?? []).map((p) => [p.serial_number, p.print_error ?? 0])
    );

    const { error } = await supabase.from("printers").upsert(
      body.printers.map((p) => ({
        serial_number: p.serial_number,
        name: p.name,
        model: p.model,
        online: p.online,
        mqtt_connected: false,
        gcode_state: p.gcode_state,
        print_percent: p.print_percent ?? 0,
        remaining_minutes: p.remaining_minutes,
        current_file: p.current_file,
        layer_current: p.layer_current,
        layer_total: p.layer_total,
        nozzle_temp: p.nozzle_temp,
        nozzle_target: p.nozzle_target,
        bed_temp: p.bed_temp,
        bed_target: p.bed_target,
        chamber_temp: p.chamber_temp,
        speed_level: p.speed_level,
        fan_speed: p.fan_speed,
        print_error: p.print_error ?? 0,
        raw_status: null,
        last_sync_at: now,
      })),
      { onConflict: "serial_number" }
    );

    if (error) {
      console.error("Elegoo sync upsert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Record printing time for stats (15s sync interval)
    recordPrintingTime(supabase, body.printers, 15).catch((err) =>
      console.error("Failed to record printing time:", err)
    );

    // Send push notifications for NEW errors
    for (const printer of body.printers) {
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

    return NextResponse.json({ synced: body.printers.length });
  } catch (err) {
    console.error("Elegoo sync error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
