import { NextRequest, NextResponse } from "next/server";
import { requireRole } from "@/lib/rbac";
import { getDocumentPdf } from "@/lib/holded/api";
import type { HoldedDocType } from "@/lib/holded/types";

const VALID_DOC_TYPES: HoldedDocType[] = ["invoice", "proform"];

export async function GET(req: NextRequest) {
  try {
    await requireRole("manager");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const docType = req.nextUrl.searchParams.get("type") as HoldedDocType;
  const docId = req.nextUrl.searchParams.get("id");

  if (!docType || !docId || !VALID_DOC_TYPES.includes(docType)) {
    return NextResponse.json({ error: "Missing type or id" }, { status: 400 });
  }

  try {
    const pdf = await getDocumentPdf(docType, docId);
    return new NextResponse(new Uint8Array(pdf), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": "inline",
      },
    });
  } catch {
    return NextResponse.json({ error: "Error fetching PDF" }, { status: 502 });
  }
}
