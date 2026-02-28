import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const key = req.headers.get("x-api-key");
  if (key !== process.env.WIDGET_API_KEY) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const supabase = createServiceClient();

  const [
    { data: projects },
    { data: printers },
    { data: printJobs },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, status, project_type, price, deadline, client_name")
      .neq("status", "discarded"),
    supabase
      .from("printers")
      .select("id, name, online, gcode_state, print_percent, remaining_minutes"),
    supabase
      .from("print_jobs")
      .select("id, status")
      .in("status", ["queued", "printing"]),
  ]);

  const allProjects = projects ?? [];
  const allPrinters = printers ?? [];
  const allJobs = printJobs ?? [];

  // --- Project counts by status ---
  const confirmed = allProjects.filter((p) => p.project_type === "confirmed");
  const upcoming = allProjects.filter((p) => p.project_type === "upcoming");

  const statusCounts: Record<string, number> = {};
  for (const p of confirmed) {
    statusCounts[p.status] = (statusCounts[p.status] ?? 0) + 1;
  }

  // --- Deadline urgency (confirmed, non-delivered) ---
  const now = new Date();
  let overdue = 0;
  let urgent = 0; // < 2 days
  let warning = 0; // < 5 days

  for (const p of confirmed) {
    if (p.status === "delivered" || !p.deadline) continue;
    const diff = (new Date(p.deadline).getTime() - now.getTime()) / 86_400_000;
    if (diff < 0) overdue++;
    else if (diff < 2) urgent++;
    else if (diff < 5) warning++;
  }

  // --- Printer summary ---
  const printersOnline = allPrinters.filter((p) => p.online).length;
  const printersPrinting = allPrinters.filter(
    (p) => p.gcode_state === "RUNNING" || p.gcode_state === "PREPARE"
  ).length;
  const printersIdle = printersOnline - printersPrinting;
  const printersError = allPrinters.filter(
    (p) => p.gcode_state === "FAILED" || p.gcode_state === "PAUSE"
  ).length;

  // --- Print queue ---
  const jobsQueued = allJobs.filter((j) => j.status === "queued").length;
  const jobsPrinting = allJobs.filter((j) => j.status === "printing").length;

  return NextResponse.json({
    updated_at: new Date().toISOString(),
    projects: {
      upcoming: upcoming.length,
      confirmed: confirmed.length,
      by_status: statusCounts,
    },
    deadlines: { overdue, urgent, warning },
    printers: {
      total: allPrinters.length,
      online: printersOnline,
      printing: printersPrinting,
      idle: printersIdle,
      error: printersError,
    },
    queue: {
      queued: jobsQueued,
      printing: jobsPrinting,
    },
  });
}
