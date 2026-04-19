import { getOrCreateSubfolder, uploadFile } from "@/lib/google-drive/client";
import { extractInvoiceData, extractInvoiceDataFromPdf } from "@/lib/invoice-ocr";
import type { gmail_v1 } from "googleapis";

const INVOICES_DRIVE_PARENT = "1bzQ0UaPk3VDltG3hyX--cHTRqJYJRczV";

const MONTH_NAMES_ES = [
  "01 - Enero", "02 - Febrero", "03 - Marzo", "04 - Abril",
  "05 - Mayo", "06 - Junio", "07 - Julio", "08 - Agosto",
  "09 - Septiembre", "10 - Octubre", "11 - Noviembre", "12 - Diciembre",
];

/**
 * Process an email as an invoice: download attachments, OCR, upload to Drive.
 */
export async function processInvoiceEmail(
  gmail: gmail_v1.Gmail,
  msg: gmail_v1.Schema$Message,
) {
  const headers = msg.payload?.headers || [];
  const emailDateStr = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
  const emailDate = emailDateStr ? new Date(emailDateStr) : new Date();

  const attachments = extractAttachments(msg.payload);
  if (attachments.length === 0) return;

  for (const att of attachments) {
    const attData = await gmail.users.messages.attachments.get({
      userId: "me",
      messageId: msg.id!,
      id: att.attachmentId,
    });

    if (!attData.data.data) continue;

    const buffer = Buffer.from(attData.data.data, "base64url");

    // OCR
    let ocrResult = { company: null as string | null, total: null as string | null, date: null as string | null };

    if (att.mimeType === "application/pdf") {
      ocrResult = await extractInvoiceDataFromPdf(buffer);
    } else if (att.mimeType.startsWith("image/")) {
      const supportedTypes = ["image/jpeg", "image/png", "image/gif", "image/webp"];
      if (supportedTypes.includes(att.mimeType)) {
        ocrResult = await extractInvoiceData(
          buffer.toString("base64"),
          att.mimeType as "image/jpeg" | "image/png" | "image/gif" | "image/webp",
        );
      }
    }

    // Determine month/year from invoice date or email date
    let invoiceMonth: number;
    let invoiceYear: number;

    if (ocrResult.date) {
      const d = new Date(ocrResult.date);
      invoiceMonth = d.getMonth() + 1;
      invoiceYear = d.getFullYear();
    } else {
      invoiceMonth = emailDate.getMonth() + 1;
      invoiceYear = emailDate.getFullYear();
    }

    // Get or create Drive folder
    const yearFolderId = await getOrCreateSubfolder(INVOICES_DRIVE_PARENT, String(invoiceYear));
    const monthFolderName = MONTH_NAMES_ES[invoiceMonth - 1];
    const monthFolderId = await getOrCreateSubfolder(yearFolderId, monthFolderName);

    // Build filename
    const companySlug = ocrResult.company
      ? ocrResult.company.replace(/\s+/g, "-").toLowerCase()
      : null;
    const totalSlug = ocrResult.total ? `_${ocrResult.total}eur` : "";
    const dateSlug = `${invoiceYear}-${String(invoiceMonth).padStart(2, "0")}`;
    const ext = att.filename.split(".").pop() || (att.mimeType === "application/pdf" ? "pdf" : "jpg");

    const fileName = companySlug
      ? `${companySlug}${totalSlug}_${dateSlug}.${ext}`
      : `factura${totalSlug}_${dateSlug}_${Date.now()}.${ext}`;

    await uploadFile(monthFolderId, fileName, att.mimeType, buffer);
    console.log(`[invoice] Uploaded: ${fileName} → ${invoiceYear}/${monthFolderName}`);
  }
}

function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { filename: string; mimeType: string; attachmentId: string }[] {
  const results: { filename: string; mimeType: string; attachmentId: string }[] = [];

  if (!payload) return results;

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.body?.attachmentId && part.filename) {
      const mime = (part.mimeType || "").toLowerCase();
      if (mime === "application/pdf" || mime.startsWith("image/")) {
        results.push({
          filename: part.filename,
          mimeType: mime,
          attachmentId: part.body.attachmentId,
        });
      }
    }
    if (part.parts) {
      for (const sub of part.parts) {
        walk(sub);
      }
    }
  }

  walk(payload);
  return results;
}
