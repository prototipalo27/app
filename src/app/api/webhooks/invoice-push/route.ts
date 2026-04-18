import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getGmailClient } from "@/lib/gmail/client";
import { getOrCreateSubfolder } from "@/lib/google-drive/client";
import { uploadFile } from "@/lib/google-drive/client";
import { extractInvoiceData, extractInvoiceDataFromPdf } from "@/lib/invoice-ocr";
import type { gmail_v1 } from "googleapis";

const INVOICES_DRIVE_PARENT = "1bzQ0UaPk3VDltG3hyX--cHTRqJYJRczV";
const INVOICE_INBOX = "administracion@prototipalo.com";

const MONTH_NAMES_ES = [
  "01 - Enero", "02 - Febrero", "03 - Marzo", "04 - Abril",
  "05 - Mayo", "06 - Junio", "07 - Julio", "08 - Agosto",
  "09 - Septiembre", "10 - Octubre", "11 - Noviembre", "12 - Diciembre",
];

/**
 * POST /api/webhooks/invoice-push
 *
 * Called by Google Cloud Pub/Sub when manu@ Gmail has new messages.
 * Filters for emails sent to administracion@prototipalo.com,
 * extracts PDF/image attachments, runs OCR, and uploads to Drive.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const pubsubMessage = body?.message;

    if (!pubsubMessage?.data) {
      return NextResponse.json({ ok: true, reason: "no_data" });
    }

    const decoded = JSON.parse(
      Buffer.from(pubsubMessage.data, "base64").toString("utf-8"),
    );
    const newHistoryId = decoded.historyId;

    if (!newHistoryId) {
      return NextResponse.json({ ok: true, reason: "no_history_id" });
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
    );

    // Get last processed historyId for invoice processing
    const { data: state } = await supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "invoice_gmail_history_id")
      .single();

    const lastHistoryId = state?.value || null;

    // Save new historyId immediately
    await supabase.from("app_metadata").upsert({
      key: "invoice_gmail_history_id",
      value: newHistoryId,
      updated_at: new Date().toISOString(),
    });

    if (!lastHistoryId) {
      return NextResponse.json({ ok: true, reason: "initial_sync" });
    }

    // Use service account with domain-wide delegation to read manu@'s Gmail
    const gmail = getGmailClient("manu@prototipalo.com");
    let messageIds: string[] = [];

    try {
      const history = await gmail.users.history.list({
        userId: "me",
        startHistoryId: lastHistoryId,
        historyTypes: ["messageAdded"],
        labelId: "INBOX",
      });

      for (const record of history.data.history || []) {
        for (const added of record.messagesAdded || []) {
          if (added.message?.id) {
            messageIds.push(added.message.id);
          }
        }
      }
    } catch (historyErr: any) {
      if (historyErr?.code === 404) {
        // historyId expired — fetch recent emails to administracion@
        const list = await gmail.users.messages.list({
          userId: "me",
          q: `to:${INVOICE_INBOX} has:attachment newer_than:7d`,
          maxResults: 20,
        });
        messageIds = (list.data.messages || []).map((m) => m.id!).filter(Boolean);
      } else {
        throw historyErr;
      }
    }

    messageIds = [...new Set(messageIds)];
    if (messageIds.length === 0) {
      return NextResponse.json({ ok: true, processed: 0 });
    }

    let processed = 0;

    for (const msgId of messageIds) {
      try {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id: msgId,
          format: "full",
        });

        // Check if this email is addressed to administracion@
        const headers = msg.data.payload?.headers || [];
        const to = (headers.find((h) => h.name?.toLowerCase() === "to")?.value || "").toLowerCase();
        const cc = (headers.find((h) => h.name?.toLowerCase() === "cc")?.value || "").toLowerCase();
        const allRecipients = `${to}, ${cc}`;

        if (!allRecipients.includes(INVOICE_INBOX)) {
          continue;
        }

        // Get email date as fallback for invoice date
        const emailDateStr = headers.find((h) => h.name?.toLowerCase() === "date")?.value || "";
        const emailDate = emailDateStr ? new Date(emailDateStr) : new Date();

        // Extract attachments
        const attachments = extractAttachments(msg.data.payload);
        if (attachments.length === 0) continue;

        for (const att of attachments) {
          // Download attachment data
          const attData = await gmail.users.messages.attachments.get({
            userId: "me",
            messageId: msgId,
            id: att.attachmentId,
          });

          if (!attData.data.data) continue;

          const buffer = Buffer.from(attData.data.data, "base64url");

          // OCR: extract company, total, date
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

          // Determine month/year from invoice date, fall back to email date
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

          // Get or create Drive folder for the month
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

          // Upload to Drive
          await uploadFile(monthFolderId, fileName, att.mimeType, buffer);
          processed++;

          console.log(`[invoice-push] Uploaded: ${fileName} → ${invoiceYear}/${monthFolderName}`);
        }

        // Mark email as processed by adding a label (optional, avoids reprocessing)
        // We rely on historyId tracking instead
      } catch (msgErr) {
        console.error(`[invoice-push] Error processing message ${msgId}:`, msgErr);
      }
    }

    return NextResponse.json({ ok: true, processed });
  } catch (err) {
    console.error("[invoice-push] Error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

/** Extract attachment metadata from a Gmail message payload */
function extractAttachments(
  payload: gmail_v1.Schema$MessagePart | undefined,
): { filename: string; mimeType: string; attachmentId: string }[] {
  const results: { filename: string; mimeType: string; attachmentId: string }[] = [];

  if (!payload) return results;

  function walk(part: gmail_v1.Schema$MessagePart) {
    if (part.body?.attachmentId && part.filename) {
      const mime = (part.mimeType || "").toLowerCase();
      // Only process PDFs and images
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
