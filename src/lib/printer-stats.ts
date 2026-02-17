import { SupabaseClient } from "@supabase/supabase-js";

/**
 * Record printing time for printers currently in RUNNING state.
 * Called by both Bambu and Elegoo sync endpoints.
 * Uses an RPC for atomic INSERT ... ON CONFLICT increment.
 */
export async function recordPrintingTime(
  supabase: SupabaseClient,
  printers: Array<{ serial_number: string; gcode_state: string | null }>,
  intervalSeconds: number
) {
  const running = printers.filter((p) => p.gcode_state === "RUNNING");
  if (running.length === 0) return;

  const serials = running.map((p) => p.serial_number);

  // Look up printer IDs by serial number
  const { data: rows } = await supabase
    .from("printers")
    .select("id")
    .in("serial_number", serials);

  if (!rows || rows.length === 0) return;

  const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

  // Atomically increment printing_seconds for each running printer
  await Promise.all(
    rows.map((row) =>
      supabase.rpc("increment_printing_seconds", {
        p_printer_id: row.id,
        p_date: today,
        p_seconds: intervalSeconds,
      })
    )
  );
}
