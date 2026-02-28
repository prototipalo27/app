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

  const debug = req.nextUrl.searchParams.get("debug") === "1";

  try {
    // Fetch raw response to inspect what Holded returns
    const apiBase = "https://api.holded.com/api/invoicing/v1";
    const apiKey = process.env.HOLDED_API_KEY;
    const res = await fetch(`${apiBase}/documents/${docType}/${docId}/pdf`, {
      headers: { key: apiKey! },
      cache: "no-store",
    });

    if (!res.ok) {
      return NextResponse.json({
        error: `Holded API returned ${res.status}`,
        statusText: res.statusText,
      }, { status: 502 });
    }

    const raw = await res.text();

    // Holded returns JSON: { status: 1, data: "<base64>" }
    // The base64 data contains HTTP headers + PDF body separated by %PDF
    let pdfBuffer: Buffer;

    try {
      const json = JSON.parse(raw);
      if (json.data && typeof json.data === "string") {
        const decoded = Buffer.from(json.data, "base64");
        const decodedStr = decoded.toString("binary");

        // Find %PDF marker — skip the HTTP headers Holded prepends
        const pdfStart = decodedStr.indexOf("%PDF");
        if (pdfStart > 0) {
          pdfBuffer = Buffer.from(decodedStr.slice(pdfStart), "binary");
        } else {
          pdfBuffer = decoded;
        }
      } else {
        return NextResponse.json({ error: "Unexpected response", keys: Object.keys(json) }, { status: 502 });
      }
    } catch {
      // Not JSON — treat as raw binary
      pdfBuffer = Buffer.from(raw, "binary");
    }

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${docType}-${docId}.pdf"`,
        "Content-Length": String(pdfBuffer.length),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error fetching PDF" }, { status: 502 });
  }
}
