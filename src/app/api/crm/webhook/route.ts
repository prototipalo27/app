import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll } from "@/lib/push-notifications/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

const SAFE_LOG_HEADERS = new Set([
  "content-type", "user-agent", "accept", "host",
  "x-forwarded-for", "x-real-ip", "origin", "referer",
]);

async function logWebhook(method: string, headers: Record<string, string>, body: string) {
  try {
    const supabase = getSupabase();
    const sanitizedHeaders: Record<string, string> = {};
    for (const [k, v] of Object.entries(headers)) {
      if (SAFE_LOG_HEADERS.has(k.toLowerCase())) {
        sanitizedHeaders[k] = v;
      }
    }
    await supabase.from("webhook_logs").insert({
      endpoint: "/api/crm/webhook",
      method,
      headers: sanitizedHeaders,
      body: body.length > 2000 ? body.slice(0, 2000) + "...[truncated]" : body,
    });
  } catch (e) {
    console.error("Failed to log webhook:", e);
  }
}

/**
 * POST /api/crm/webhook
 *
 * Receives form submissions from Webflow and creates leads.
 * Protected by CRM_WEBHOOK_SECRET via Authorization header or query param.
 */
export async function POST(request: NextRequest) {
  // Capture raw body first for debugging
  const rawBody = await request.text();
  const headerObj: Record<string, string> = {};
  request.headers.forEach((v, k) => { headerObj[k] = v; });

  // Log sanitized data before validation
  await logWebhook("POST", headerObj, rawBody);

  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) {
    const bearer = request.headers.get("authorization")?.replace("Bearer ", "");
    const queryToken = new URL(request.url).searchParams.get("secret");
    const token = bearer || queryToken || "";
    if (!token || !safeCompare(token, secret)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = JSON.parse(rawBody);

    // Webflow sends data nested under payload.data or directly
    const data = payload?.data || payload;

    // Helper: find a field value by checking multiple possible key names (case-insensitive)
    function findField(obj: Record<string, unknown>, keys: string[]): string | null {
      for (const key of keys) {
        const lower = key.toLowerCase();
        for (const [k, v] of Object.entries(obj)) {
          if (k.toLowerCase() === lower && v) return String(v);
        }
      }
      return null;
    }

    const fullName = findField(data, [
      "Nombre completo", "nombre-completo", "nombre_completo",
      "full_name", "full-name", "fullname", "name", "nombre",
    ]) || "";
    const company = findField(data, [
      "Empresa", "empresa", "company", "compañia", "compania",
    ]);
    const email = findField(data, [
      "Email", "email", "e-mail", "correo",
    ]);
    const phone = findField(data, [
      "Telefono", "telefono", "teléfono", "phone", "tel",
    ]);
    const message = findField(data, [
      "Mensaje", "mensaje", "message", "comentario", "comentarios",
    ]);
    const attachments = findField(data, [
      "Archivos", "archivos", "files", "attachments", "archivo", "file",
    ]);
    const emailSubjectTag = findField(data, [
      "email_subject_tag", "emailSubjectTag",
    ]);
    const submissionId =
      payload?._id || payload?.submissionId || data?._id || null;

    if (!fullName?.trim()) {
      return NextResponse.json(
        { error: "Nombre completo es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check for duplicate submission
    if (submissionId) {
      const { data: existing } = await supabase
        .from("leads")
        .select("id")
        .eq("webflow_submission_id", submissionId)
        .single();

      if (existing) {
        return NextResponse.json({
          ok: true,
          duplicate: true,
          lead_id: existing.id,
        });
      }
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        full_name: fullName.trim(),
        company: company?.trim() || null,
        email: email?.trim() || null,
        phone: phone?.trim() || null,
        message: message?.trim() || null,
        attachments: attachments?.trim() || null,
        email_subject_tag: emailSubjectTag?.trim() || null,
        source: "webflow",
        status: "new",
        webflow_submission_id: submissionId || null,
      })
      .select("id")
      .single();

    if (error) {
      console.error("CRM webhook insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Send push notification
    await sendPushToAll({
      title: "Nuevo lead",
      body: `${fullName.trim()}${company ? ` - ${company.trim()}` : ""}`,
      url: `/dashboard/crm/${lead.id}`,
    }).catch((err) => console.error("Push notification error:", err));

    return NextResponse.json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("CRM webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// Also handle GET in case Webflow sends a verification request
export async function GET(request: NextRequest) {
  const headerObj: Record<string, string> = {};
  request.headers.forEach((v, k) => { headerObj[k] = v; });
  await logWebhook("GET", headerObj, new URL(request.url).search);

  return NextResponse.json({ ok: true, message: "CRM webhook is active" });
}
