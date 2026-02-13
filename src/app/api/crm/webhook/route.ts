import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendPushToAll } from "@/lib/push-notifications/server";

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

/**
 * POST /api/crm/webhook?secret=CRM_WEBHOOK_SECRET
 *
 * Receives form submissions from Webflow and creates leads.
 * Protected by CRM_WEBHOOK_SECRET query param.
 */
export async function POST(request: NextRequest) {
  const secret = process.env.CRM_WEBHOOK_SECRET;
  if (secret) {
    const url = new URL(request.url);
    const token = url.searchParams.get("secret");
    if (token !== secret) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
  }

  try {
    const payload = await request.json();

    // Webflow sends data nested under payload.data or directly
    const data = payload?.data || payload;

    const fullName =
      data["Nombre completo"] || data["full_name"] || data["name"] || "";
    const company = data["Empresa"] || data["company"] || null;
    const email = data["Email"] || data["email"] || null;
    const phone = data["Telefono"] || data["phone"] || null;
    const message = data["Mensaje"] || data["message"] || null;
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
