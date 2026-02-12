import webpush from "web-push";
import { createClient } from "@supabase/supabase-js";

let vapidInitialized = false;

function ensureVapid() {
  if (vapidInitialized) return true;
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) {
    console.warn("VAPID keys not configured — push notifications disabled");
    return false;
  }
  webpush.setVapidDetails("mailto:info@prototipalo.com", publicKey, privateKey);
  vapidInitialized = true;
  return true;
}

interface PushPayload {
  title: string;
  body: string;
  url?: string;
}

function getSupabase() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );
}

export async function sendPushToAll(payload: PushPayload) {
  if (!ensureVapid()) return;
  const supabase = getSupabase();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth");

  if (!subscriptions?.length) return;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  // Clean up expired subscriptions (410 Gone)
  const expired = results
    .map((r, i) => ({ result: r, sub: subscriptions[i] }))
    .filter(
      ({ result }) =>
        result.status === "rejected" &&
        (result.reason as { statusCode?: number })?.statusCode === 410
    )
    .map(({ sub }) => sub.id);

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }
}

export async function sendPushToUser(userId: string, payload: PushPayload) {
  if (!ensureVapid()) return;
  const supabase = getSupabase();
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .eq("user_id", userId);

  if (!subscriptions?.length) return;

  const results = await Promise.allSettled(
    subscriptions.map((sub) =>
      webpush.sendNotification(
        {
          endpoint: sub.endpoint,
          keys: { p256dh: sub.p256dh, auth: sub.auth },
        },
        JSON.stringify(payload)
      )
    )
  );

  const expired = results
    .map((r, i) => ({ result: r, sub: subscriptions[i] }))
    .filter(
      ({ result }) =>
        result.status === "rejected" &&
        (result.reason as { statusCode?: number })?.statusCode === 410
    )
    .map(({ sub }) => sub.id);

  if (expired.length > 0) {
    await supabase.from("push_subscriptions").delete().in("id", expired);
  }
}
