import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { sendPushToUser, sendPushToAll } from "@/lib/push-notifications/server";

/**
 * POST /api/notifications/test
 *
 * Send a test push notification. Requires authenticated manager.
 * Body: { target?: "me" | "all", title?, body? }
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Check manager role
  const { data: profile } = await supabase
    .from("user_profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile || !["manager", "super_admin"].includes(profile.role)) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const target = body.target || "me";
  const title = body.title || "Test de notificación";
  const message = body.body || "Si ves esto, las push funcionan correctamente.";

  const payload = {
    title,
    body: message,
    url: "/dashboard",
  };

  if (target === "all") {
    await sendPushToAll(payload);
  } else {
    await sendPushToUser(user.id, payload);
  }

  return NextResponse.json({ ok: true, target });
}
