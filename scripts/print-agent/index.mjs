#!/usr/bin/env node

/**
 * Print Agent — corre en el PC al que está conectada la impresora física.
 *
 * Se suscribe a la cola `label_print_jobs` vía Supabase Realtime. Cuando llega un
 * job nuevo: marca printing, descarga el PDF de label_url, lo manda al
 * spooler del SO, y marca printed/error.
 *
 * Plataformas soportadas:
 *   - Windows: usa SumatraPDF (-print-to "<Printer>")
 *   - macOS/Linux: usa `lp -d <Printer>` (CUPS)
 *
 * Env vars requeridas:
 *   SUPABASE_URL                  — URL del proyecto Supabase
 *   SUPABASE_SERVICE_ROLE_KEY     — service role (necesaria para UPDATE)
 *
 * Env vars opcionales:
 *   PRINTER_NAME                  — nombre del spooler (default: "Munbyn")
 *   SUMATRA_PATH                  — ruta a SumatraPDF.exe (Windows; default:
 *                                   "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe")
 */

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir, platform } from "node:os";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const PRINTER = process.env.PRINTER_NAME || "Munbyn";
const SUMATRA = process.env.SUMATRA_PATH ||
  "C:\\Program Files\\SumatraPDF\\SumatraPDF.exe";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const IS_WINDOWS = platform() === "win32";
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

function printPdf(filePath, printerLabel) {
  return new Promise((resolve, reject) => {
    const printer = printerLabel || PRINTER;

    if (IS_WINDOWS) {
      // SumatraPDF imprime y sale. -silent evita popups si falla.
      execFile(
        SUMATRA,
        ["-print-to", printer, "-silent", filePath],
        (err, _stdout, stderr) => {
          if (err) reject(new Error(stderr || err.message));
          else resolve();
        },
      );
    } else {
      execFile("lp", ["-d", printer, filePath], (err, _stdout, stderr) => {
        if (err) reject(new Error(stderr || err.message));
        else resolve();
      });
    }
  });
}

async function setStatus(id, status, extras = {}) {
  const { error } = await supabase
    .from("label_print_jobs")
    .update({ status, ...extras })
    .eq("id", id);
  if (error) {
    console.error(`[${id}] Failed to update status to ${status}:`, error.message);
  }
}

async function handleJob(job) {
  const { id, label_url, printer_label } = job;
  console.log(`[${id}] New job — downloading label...`);

  await setStatus(id, "printing");

  let tmpPath = null;
  try {
    const res = await fetch(label_url);
    if (!res.ok) throw new Error(`HTTP ${res.status} downloading PDF`);

    const buffer = Buffer.from(await res.arrayBuffer());
    tmpPath = join(tmpdir(), `print-job-${id}.pdf`);
    await writeFile(tmpPath, buffer);

    await printPdf(tmpPath, printer_label);
    await setStatus(id, "printed", {
      printed_at: new Date().toISOString(),
      error_message: null,
    });
    console.log(`[${id}] Printed on "${printer_label || PRINTER}"`);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[${id}] Print failed:`, message);
    await setStatus(id, "error", { error_message: message });
  } finally {
    if (tmpPath) {
      await unlink(tmpPath).catch(() => {});
    }
  }
}

// Al arrancar, procesa cualquier job pendiente que llegara mientras el
// agente estaba caído. Realtime no entrega histórico.
async function drainPending() {
  const { data, error } = await supabase
    .from("label_print_jobs")
    .select("id, label_url, printer_label")
    .eq("status", "pending")
    .order("created_at", { ascending: true });
  if (error) {
    console.error("Failed to fetch pending jobs:", error.message);
    return;
  }
  if (data && data.length > 0) {
    console.log(`Found ${data.length} pending job(s) on startup.`);
    for (const job of data) {
      await handleJob(job);
    }
  }
}

await drainPending();

const channel = supabase
  .channel("print-jobs-agent")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "label_print_jobs" },
    (payload) => {
      handleJob(payload.new);
    },
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(
        `Print agent ready — platform: ${IS_WINDOWS ? "windows" : "unix"}, ` +
          `printer: "${PRINTER}"`,
      );
    } else {
      console.log("Channel status:", status);
    }
  });

process.on("SIGINT", () => {
  console.log("\nShutting down...");
  supabase.removeChannel(channel);
  process.exit(0);
});
