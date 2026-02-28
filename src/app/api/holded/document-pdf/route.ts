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

    const contentType = res.headers.get("content-type") || "";
    const raw = await res.arrayBuffer();

    if (debug) {
      const snippet = Buffer.from(raw).toString("utf8").slice(0, 500);
      return NextResponse.json({
        contentType,
        size: raw.byteLength,
        startsWithPDF: snippet.startsWith("%PDF"),
        snippet,
      });
    }

    // If it's JSON with base64 data
    if (contentType.includes("application/json")) {
      const text = Buffer.from(raw).toString("utf8");
      const json = JSON.parse(text);
      const b64 = json.data || json.pdf || json.file;
      if (typeof b64 === "string") {
        const pdfBuf = Buffer.from(b64, "base64");
        return new NextResponse(new Uint8Array(pdfBuf), {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename="${docType}-${docId}.pdf"`,
            "Content-Length": String(pdfBuf.length),
          },
        });
      }
      return NextResponse.json({ error: "Unexpected JSON structure", keys: Object.keys(json) }, { status: 502 });
    }

    // Binary PDF
    return new NextResponse(raw, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${docType}-${docId}.pdf"`,
        "Content-Length": String(raw.byteLength),
      },
    });
  } catch (e) {
    return NextResponse.json({ error: e instanceof Error ? e.message : "Error fetching PDF" }, { status: 502 });
  }
}
