import { NextRequest, NextResponse } from "next/server";
import { timingSafeEqual } from "crypto";
import { createClient } from "@supabase/supabase-js";
import { sendPushForEvent } from "@/lib/push-notifications/server";
import { generateAndSaveDraft } from "@/lib/ai-draft";
import { detectProjectTypeTag } from "@/lib/lead-tagger";
// AI estimation is now handled by Postgres trigger auto_estimate_lead

// Gonzalo (gonzalo@prototipalo.com) — commercial owner for Webflow leads
const GONZALO_USER_ID = "9a7664db-917a-424b-af30-87d0bc3725ff";

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

    // Webflow sends data nested under payload.payload.data, payload.data, or directly
    const data = payload?.payload?.data || payload?.data || payload;

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
    // New flow: the Webflow form uploads directly to Supabase Storage under
    // pending/{token}/ and posts back this token. The old `attachments`
    // field (Uploadcare URL) is kept as a fallback for any in-flight submit.
    const attachmentToken = findField(data, [
      "attachment_token", "attachmentToken", "attachment-token",
    ]);
    const emailSubjectTag = findField(data, [
      "email_subject_tag", "emailSubjectTag",
    ]);
    const VALID_SOURCES = ["webflow", "email", "whatsapp", "manual", "phone", "in_person", "other"] as const;
    const rawSource = findField(data, ["source"]);
    const source = VALID_SOURCES.includes(rawSource as any) ? rawSource! : "webflow";
    const submissionId =
      payload?.payload?.id || payload?._id || payload?.submissionId || data?._id || null;

    // ── UTM tracking fields ──
    const utmSource = findField(data, ["utm_source", "utmSource", "utm-source"]);
    const utmMedium = findField(data, ["utm_medium", "utmMedium", "utm-medium"]);
    const utmCampaign = findField(data, ["utm_campaign", "utmCampaign", "utm-campaign"]);
    const utmTerm = findField(data, ["utm_term", "utmTerm", "utm-term"]);
    const utmContent = findField(data, ["utm_content", "utmContent", "utm-content"]);
    const gclid = findField(data, ["gclid"]);
    const fbclid = findField(data, ["fbclid"]);
    const msclkid = findField(data, ["msclkid"]);
    const ttclid = findField(data, ["ttclid"]);
    const referrer = findField(data, ["referrer", "referer", "http_referrer"]);
    const landingPage = findField(data, ["landing_page", "landingPage", "landing-page"]);
    const currentPage = findField(data, ["current_page", "currentPage", "current-page"]);
    const firstTouchPage = findField(data, ["first_touch_page", "firstTouchPage"]);
    const firstTouchReferrer = findField(data, ["first_touch_referrer", "firstTouchReferrer"]);
    const firstTouchTimestamp = findField(data, ["first_touch_timestamp", "firstTouchTimestamp"]);
    const lastTouchTimestamp = findField(data, ["last_touch_timestamp", "lastTouchTimestamp"]);
    const sessionId = findField(data, ["session_id", "sessionId", "session-id"]);

    const utmFields = {
      utm_source: utmSource,
      utm_medium: utmMedium,
      utm_campaign: utmCampaign,
      utm_term: utmTerm,
      utm_content: utmContent,
      gclid,
      fbclid,
      msclkid,
      ttclid,
      referrer,
      landing_page: landingPage,
      current_page: currentPage,
      first_touch_page: firstTouchPage,
      first_touch_referrer: firstTouchReferrer,
      first_touch_timestamp: firstTouchTimestamp || null,
      last_touch_timestamp: lastTouchTimestamp || null,
      session_id: sessionId,
    };
    const hasUtmData = utmSource || utmMedium || utmCampaign || gclid || fbclid || msclkid || ttclid || referrer || landingPage;

    if (!fullName?.trim()) {
      return NextResponse.json(
        { error: "Nombre completo es obligatorio" },
        { status: 400 }
      );
    }

    const supabase = getSupabase();

    // Check for duplicate submission by webflow_submission_id
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

    // Check for duplicate by email (prevents double-submit race condition)
    const normalizedEmail = email?.trim().toLowerCase() || null;
    if (normalizedEmail) {
      const { data: existingByEmail } = await supabase
        .from("leads")
        .select("id")
        .ilike("email", normalizedEmail)
        .limit(1)
        .single();

      if (existingByEmail) {
        // Update existing lead with any new info from the form
        await supabase
          .from("leads")
          .update({
            webflow_submission_id: submissionId || undefined,
            phone: phone?.trim() || undefined,
            company: company?.trim() || undefined,
            attachments: attachments?.trim() || undefined,
          })
          .eq("id", existingByEmail.id);

        // Save / update UTM tracking data
        if (hasUtmData) {
          const { error: utmErr } = await supabase
            .from("lead_utm_data")
            .upsert({ lead_id: existingByEmail.id, ...utmFields }, { onConflict: "lead_id" });
          if (utmErr) console.error("UTM upsert error (dup email):", utmErr);
        }

        // Same as the new-lead path: drain any files uploaded during this submit.
        if (attachmentToken) {
          claimPendingAttachments(supabase, existingByEmail.id, attachmentToken).catch((err) =>
            console.error("[crm/webhook] claimPendingAttachments (dup) failed:", err),
          );
        }

        return NextResponse.json({
          ok: true,
          duplicate: true,
          lead_id: existingByEmail.id,
        });
      }
    }

    const { data: lead, error } = await supabase
      .from("leads")
      .insert({
        full_name: fullName.trim(),
        company: company?.trim() || null,
        email: normalizedEmail,
        phone: phone?.trim() || null,
        message: message?.trim() || null,
        attachments: attachments?.trim() || null,
        email_subject_tag: emailSubjectTag?.trim() || null,
        source,
        status: "new",
        owned_by: GONZALO_USER_ID,
        webflow_submission_id: submissionId || null,
      })
      .select("id")
      .single();

    if (error) {
      // Handle unique constraint violation (race condition fallback)
      if (error.code === "23505") {
        const { data: raced } = await supabase
          .from("leads")
          .select("id")
          .ilike("email", normalizedEmail!)
          .limit(1)
          .single();
        return NextResponse.json({
          ok: true,
          duplicate: true,
          lead_id: raced?.id,
        });
      }
      console.error("CRM webhook insert error:", error);
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    // Save UTM tracking data
    if (hasUtmData && lead?.id) {
      const { error: utmErr } = await supabase
        .from("lead_utm_data")
        .insert({ lead_id: lead.id, ...utmFields });
      if (utmErr) console.error("UTM insert error:", utmErr);
    }

    // Claim any files uploaded directly to Supabase Storage during the
    // form session, and register them as lead_attachments rows so
    // qualifyLead drains them into Drive at qualification time.
    if (attachmentToken) {
      claimPendingAttachments(supabase, lead.id, attachmentToken).catch((err) =>
        console.error("[crm/webhook] claimPendingAttachments failed:", err),
      );
    }

    // Auto-detect project type tag
    detectProjectTypeTag(message?.trim() || null)
      .then(async (tag) => {
        if (tag) {
          await supabase.from("leads").update({ project_type_tag: tag }).eq("id", lead.id);
        }
      })
      .catch((err) => console.error("Lead tagger error:", err));

    // Generate AI draft in background (non-blocking)
    generateAndSaveDraft(lead.id, {
      fullName: fullName.trim(),
      company: company?.trim(),
      message: message?.trim(),
    }).catch((err) => console.error("AI draft error:", err));

    // Send push notification
    const titleParts = [fullName.trim(), company?.trim()].filter(Boolean);
    await sendPushForEvent("new_lead", {
      title: `📩 ${titleParts.join(" - ")}`,
      body: message?.trim()?.slice(0, 120) || "Nuevo lead recibido",
      url: `/dashboard/crm/${lead.id}`,
      phone: phone?.trim() || undefined,
    }).catch((err) => console.error("Push notification error:", err));

    return NextResponse.json({ ok: true, lead_id: lead.id });
  } catch (err) {
    console.error("CRM webhook error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

const MIME_BY_EXT: Record<string, string> = {
  jpg: "image/jpeg",
  jpeg: "image/jpeg",
  png: "image/png",
  gif: "image/gif",
  webp: "image/webp",
  heic: "image/heic",
  heif: "image/heif",
  avif: "image/avif",
  svg: "image/svg+xml",
  pdf: "application/pdf",
  doc: "application/msword",
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  xls: "application/vnd.ms-excel",
  xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
};

function guessMimeFromName(name: string): string {
  const ext = name.toLowerCase().split(".").pop() ?? "";
  return MIME_BY_EXT[ext] || "application/octet-stream";
}

/**
 * Move files uploaded via the public form (parked under `pending/{token}/`)
 * into the lead's namespace and register them as lead_attachments rows.
 * Idempotent: skips files that were already claimed.
 */
async function claimPendingAttachments(
  supabase: ReturnType<typeof getSupabase>,
  leadId: string,
  token: string,
) {
  if (!/^[a-f0-9-]{36}$/i.test(token)) return;

  const { data: listed, error: listErr } = await supabase.storage
    .from("lead-attachments")
    .list(`pending/${token}`, { limit: 100 });
  if (listErr) throw listErr;
  if (!listed || listed.length === 0) return;

  for (const obj of listed) {
    if (!obj.name) continue;
    const fromPath = `pending/${token}/${obj.name}`;
    const toPath = `${leadId}/${Date.now()}-${obj.name}`;

    const { error: moveErr } = await supabase.storage
      .from("lead-attachments")
      .move(fromPath, toPath);
    if (moveErr) {
      console.error(`[claimPendingAttachments] move ${fromPath} failed:`, moveErr);
      continue;
    }

    // Supabase Storage's list() doesn't always expose mimetype, so fall back
    // to the filename extension — that's what the gallery uses to pick the
    // right preview, and what we forward to Drive on qualification.
    const reportedMime = obj.metadata?.mimetype;
    const mime = reportedMime && reportedMime !== "application/octet-stream"
      ? reportedMime
      : guessMimeFromName(obj.name);

    await supabase.from("lead_attachments").insert({
      lead_id: leadId,
      source: "webflow",
      filename: obj.name,
      mime_type: mime,
      storage_path: toPath,
    });
  }
}

// Also handle GET in case Webflow sends a verification request
export async function GET(request: NextRequest) {
  const headerObj: Record<string, string> = {};
  request.headers.forEach((v, k) => { headerObj[k] = v; });
  await logWebhook("GET", headerObj, new URL(request.url).search);

  return NextResponse.json({ ok: true, message: "CRM webhook is active" });
}
