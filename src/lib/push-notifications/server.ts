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
  phone?: string;
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

/**
 * Send push notifications based on event type configuration and user preferences.
 * 1. Checks if the event is enabled in notification_event_config
 * 2. Finds users whose role matches target_roles OR are in target_user_ids
 * 3. Filters out users who have opted out via user_notification_preferences
 * 4. Sends push to remaining users
 *
 * @param eventType - The event type key (e.g. 'new_lead', 'task_assigned')
 * @param payload - Push notification content
 * @param targetUserId - If set, only send to this specific user (for personal events like task_assigned)
 */
export async function sendPushForEvent(
  eventType: string,
  payload: PushPayload,
  targetUserId?: string
) {
  if (!ensureVapid()) return;
  const supabase = getSupabase();

  // 1. Get event config
  const { data: config } = await supabase
    .from("notification_event_config")
    .select("target_roles, target_user_ids, enabled")
    .eq("event_type", eventType)
    .single();

  // If no config or disabled, fall back to sendPushToAll for backwards compat
  if (!config) {
    console.warn(`No notification config for event "${eventType}", sending to all`);
    if (targetUserId) {
      return sendPushToUser(targetUserId, payload);
    }
    return sendPushToAll(payload);
  }

  if (!config.enabled) return;

  // 2. If this is a personal event (targetUserId), check if that user should receive it
  if (targetUserId) {
    // Check if user has opted out
    const { data: pref } = await supabase
      .from("user_notification_preferences")
      .select("push_enabled")
      .eq("user_id", targetUserId)
      .eq("event_type", eventType)
      .single();

    if (pref && !pref.push_enabled) return;

    return sendPushToUser(targetUserId, payload);
  }

  // 3. Get all users with matching roles
  const targetRoles = config.target_roles ?? [];
  const targetUserIds = config.target_user_ids ?? [];

  let query = supabase
    .from("user_profiles")
    .select("id, role")
    .eq("is_active", true);

  // Build filter: role in target_roles OR id in target_user_ids
  if (targetRoles.length > 0 && targetUserIds.length > 0) {
    query = query.or(
      `role.in.(${targetRoles.join(",")}),id.in.(${targetUserIds.join(",")})`
    );
  } else if (targetRoles.length > 0) {
    query = query.in("role", targetRoles);
  } else if (targetUserIds.length > 0) {
    query = query.in("id", targetUserIds);
  } else {
    return; // No targets configured
  }

  const { data: users } = await query;
  if (!users?.length) return;

  // 4. Get opted-out users for this event
  const userIds = users.map((u) => u.id);
  const { data: optedOut } = await supabase
    .from("user_notification_preferences")
    .select("user_id")
    .eq("event_type", eventType)
    .eq("push_enabled", false)
    .in("user_id", userIds);

  const optedOutIds = new Set(optedOut?.map((p) => p.user_id) ?? []);
  const eligibleUserIds = userIds.filter((id) => !optedOutIds.has(id));

  if (!eligibleUserIds.length) return;

  // 5. Get push subscriptions for eligible users
  const { data: subscriptions } = await supabase
    .from("push_subscriptions")
    .select("id, endpoint, p256dh, auth")
    .in("user_id", eligibleUserIds);

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

  // Clean up expired subscriptions
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
