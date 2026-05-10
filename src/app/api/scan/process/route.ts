import { NextRequest, NextResponse } from "next/server";
import { extractInvoiceData, extractInvoiceDataFromPdf } from "@/lib/invoice-ocr";
import { uploadFile, renameFile } from "@/lib/google-drive/client";
import { slugifyCompany } from "@/lib/invoice-slug";

function validateAuth(request: NextRequest): boolean {
  const pin = request.headers.get("x-scan-pin");
  const expected = process.env.SCAN_PIN;
  if (pin && expected && pin === expected) return true;

  const hasAuthCookie = request.cookies.getAll().some((c) => c.name.startsWith("sb-"));
  return hasAuthCookie;
}

const SUPPORTED_IMAGE = ["image/jpeg", "image/png", "image/gif", "image/webp"] as const;
type ImageMediaType = (typeof SUPPORTED_IMAGE)[number];

/**
 * POST /api/scan/process
 *
 * Procesa una factura en una sola petición:
 *  1. OCR + subida a Drive corren EN PARALELO (Promise.all).
 *  2. La subida usa un nombre temporal; cuando OCR responde con
 *     empresa/importe, se renombra el archivo en Drive.
 *
 * Esto sustituye al flujo antiguo (OCR → upload secuencial, dos
 * petitiones del cliente con la imagen duplicada). El cliente solo
 * envía la imagen una vez y espera ~max(ocr, upload) en lugar de la
 * suma.
 *
 * FormData: file, folderId, month (1-12), year
 * Returns: { id, name, webViewLink, company, total, date }
 */
export async function POST(request: NextRequest) {
  if (!validateAuth(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  try {
    const formData = await request.formData();
    const file = formData.get("file") as File | null;
    const folderId = formData.get("folderId") as string | null;
    const month = Number(formData.get("month"));
    const year = Number(formData.get("year"));

    if (!file || !folderId) {
      return NextResponse.json({ error: "Missing file or folderId" }, { status: 400 });
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const mimeType = file.type || "image/jpeg";
    const ext = file.name.split(".").pop() || (mimeType === "application/pdf" ? "pdf" : "jpg");
    const tempName = `scan_${Date.now()}.${ext}`;

    // OCR + upload en paralelo
    const isPdf = mimeType === "application/pdf";
    const isImage = (SUPPORTED_IMAGE as readonly string[]).includes(mimeType);

    const ocrPromise = isPdf
      ? extractInvoiceDataFromPdf(buffer)
      : isImage
        ? extractInvoiceData(buffer.toString("base64"), mimeType as ImageMediaType)
        : Promise.resolve({ company: null, total: null, date: null });

    const uploadPromise = uploadFile(folderId, tempName, mimeType, buffer);

    const [ocrResult, driveFile] = await Promise.all([ocrPromise, uploadPromise]);

    // Build final filename from OCR result
    const companySlug = ocrResult.company ? slugifyCompany(ocrResult.company) : null;
    const totalSlug = ocrResult.total ? `_${ocrResult.total}eur` : "";
    const finalName = companySlug
      ? `${companySlug}${totalSlug}_${year}-${String(month).padStart(2, "0")}_${Date.now()}.${ext}`
      : `factura${totalSlug}_${year}-${String(month).padStart(2, "0")}_${Date.now()}.${ext}`;

    // Renombrar en Drive si tenemos algo útil del OCR (si no, dejamos temp)
    if (finalName !== tempName && (companySlug || ocrResult.total)) {
      try {
        await renameFile(driveFile.id, finalName);
        driveFile.name = finalName;
      } catch (err) {
        console.error("[Scan Process] Rename failed (file uploaded ok):", err);
      }
    }

    return NextResponse.json({
      id: driveFile.id,
      name: driveFile.name,
      webViewLink: driveFile.webViewLink,
      company: ocrResult.company,
      total: ocrResult.total,
      date: ocrResult.date,
    });
  } catch (err) {
    console.error("[Scan Process] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
