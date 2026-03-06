#!/usr/bin/env node

/**
 * Print Agent — runs on the Raspberry Pi.
 *
 * Listens for new rows in `shipping_info` via Supabase Realtime.
 * When a label_url is present, downloads the PDF and prints it
 * on the local CUPS printer.
 *
 * Usage:
 *   SUPABASE_URL=https://xxx.supabase.co SUPABASE_ANON_KEY=xxx node print-agent.mjs
 *
 * Optional env vars:
 *   PRINTER_NAME  — CUPS printer name (default: "etiquetas")
 */

import { createClient } from "@supabase/supabase-js";
import { execFile } from "node:child_process";
import { writeFile, unlink } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY;
const PRINTER = process.env.PRINTER_NAME || "etiquetas";

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error("Missing SUPABASE_URL or SUPABASE_ANON_KEY");
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

function printPdf(filePath) {
  return new Promise((resolve, reject) => {
    execFile("lp", ["-d", PRINTER, filePath], (err, stdout, stderr) => {
      if (err) {
        reject(new Error(stderr || err.message));
      } else {
        resolve(stdout.trim());
      }
    });
  });
}

async function handleNewShipment(payload) {
  const row = payload.new;
  const id = row.id;
  const labelUrl = row.label_url;
  const carrier = row.carrier || "unknown";
  const ref = row.mrw_albaran || row.gls_barcode || row.packlink_shipment_ref || id;

  if (!labelUrl) {
    console.log(`[${ref}] No label_url, skipping`);
    return;
  }

  console.log(`[${ref}] New ${carrier} shipment — downloading label...`);

  try {
    const res = await fetch(labelUrl);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);

    const buffer = Buffer.from(await res.arrayBuffer());
    const tmpPath = join(tmpdir(), `label-${ref}.pdf`);

    await writeFile(tmpPath, buffer);
    const result = await printPdf(tmpPath);
    console.log(`[${ref}] Sent to printer "${PRINTER}": ${result}`);

    // Clean up temp file
    await unlink(tmpPath).catch(() => {});
  } catch (err) {
    console.error(`[${ref}] Print failed:`, err.message);
  }
}

// Subscribe to new shipping_info rows
const channel = supabase
  .channel("shipping-labels")
  .on(
    "postgres_changes",
    { event: "INSERT", schema: "public", table: "shipping_info" },
    handleNewShipment,
  )
  .subscribe((status) => {
    if (status === "SUBSCRIBED") {
      console.log(`Print agent running — printer: "${PRINTER}"`);
      console.log("Listening for new shipments...");
    } else {
      console.log("Supabase channel status:", status);
    }
  });

// Keep process alive, handle graceful shutdown
process.on("SIGINT", () => {
  console.log("\nShutting down...");
  supabase.removeChannel(channel);
  process.exit(0);
});
