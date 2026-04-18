import { NextRequest, NextResponse } from "next/server";
import { getOrCreateSubfolder } from "@/lib/google-drive/client";

const INVOICES_DRIVE_PARENT = "1bzQ0UaPk3VDltG3hyX--cHTRqJYJRczV";

const MONTH_NAMES_ES = [
  "01 - Enero", "02 - Febrero", "03 - Marzo", "04 - Abril",
  "05 - Mayo", "06 - Junio", "07 - Julio", "08 - Agosto",
  "09 - Septiembre", "10 - Octubre", "11 - Noviembre", "12 - Diciembre",
];

function validateAuth(request: NextRequest): boolean {
  // PIN auth (standalone scan)
  const pin = request.headers.get("x-scan-pin");
  const expected = process.env.SCAN_PIN;
  if (pin && expected && pin === expected) return true;

  // Cookie auth (dashboard user)
  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  return hasAuthCookie;
}

/**
 * POST /api/scan/folder
 * Body: { month: number, year: number }
 * Auth: x-scan-pin header OR Supabase session cookie
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const { month, year } = await request.json();
    if (!month || !year) {
      return NextResponse.json({ error: "Faltan month o year" }, { status: 400 });
    }

    const yearFolderId = await getOrCreateSubfolder(INVOICES_DRIVE_PARENT, String(year));
    const monthFolderName = MONTH_NAMES_ES[month - 1];
    const monthFolderId = await getOrCreateSubfolder(yearFolderId, monthFolderName);

    return NextResponse.json({ folderId: monthFolderId });
  } catch (err) {
    console.error("[Scan Folder] Error:", err);
    const message = err instanceof Error ? err.message : "Error al acceder a Drive";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
