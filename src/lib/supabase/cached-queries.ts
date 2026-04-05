import { cacheLife, cacheTag } from "next/cache";
import { createServiceClient } from "@/lib/supabase/server";
import {
  classifyTrafficSource,
  ALL_SOURCES,
  type TrafficSource,
} from "@/lib/utm-utils";

// ── Shared data (same for all users, uses service client) ────────────

export async function getSharedUserProfiles() {
  "use cache";
  cacheLife("hours");
  cacheTag("user-profiles");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, email, role, is_active")
    .eq("is_active", true)
    .order("email");
  return data ?? [];
}

export async function getSharedZoneAssignments() {
  "use cache";
  cacheLife("hours");
  cacheTag("zone-assignments");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("zone_assignments")
    .select("user_id, zone");
  return data ?? [];
}

export async function getSharedBasePrices() {
  "use cache";
  cacheLife("hours");
  cacheTag("base-prices");

  const supabase = createServiceClient();
  const { data } = await supabase
    .from("base_prices")
    .select("category, price_per_unit")
    .order("category");

  const map: Record<string, number> = {};
  for (const row of data || []) {
    map[row.category] = Number(row.price_per_unit);
  }
  return map;
}

// ── User-scoped data (userId as parameter → automatic cache key) ─────

export async function getUserTaskCount(userId: string) {
  "use cache";
  cacheLife("minutes");
  cacheTag("tasks", `tasks-${userId}`);

  const supabase = createServiceClient();
  const { count } = await supabase
    .from("tasks")
    .select("id", { count: "exact", head: true })
    .eq("assigned_to", userId)
    .in("status", ["pending", "in_progress"]);
  return count ?? 0;
}

// ── Page-level cached data ───────────────────────────────────────────

type SourceRow = {
  source: TrafficSource;
  total: number;
  thisMonth: number;
  lastMonth: number;
  won: number;
};

export async function getCachedLeadSourceAnalytics() {
  "use cache";
  cacheLife("minutes");
  cacheTag("leads");

  const supabase = createServiceClient();
  const [{ data: allLeads }, { data: utmRows }] = await Promise.all([
    supabase.from("leads").select("id, source, status, created_at"),
    supabase
      .from("lead_utm_data")
      .select(
        "lead_id, utm_source, utm_medium, utm_campaign, gclid, fbclid, msclkid, ttclid, referrer"
      ),
  ]);

  const now = new Date();
  const curMonth = now.getMonth();
  const curYear = now.getFullYear();
  const prevMonth = curMonth === 0 ? 11 : curMonth - 1;
  const prevMonthYear = curMonth === 0 ? curYear - 1 : curYear;

  const utmByLeadId = new Map(
    (utmRows ?? []).map((u) => [u.lead_id, u])
  );

  const sourceMap = new Map<TrafficSource, SourceRow>();
  for (const l of allLeads ?? []) {
    const ts = classifyTrafficSource(l.source, utmByLeadId.get(l.id) ?? null);
    let row = sourceMap.get(ts);
    if (!row) {
      row = { source: ts, total: 0, thisMonth: 0, lastMonth: 0, won: 0 };
      sourceMap.set(ts, row);
    }
    row.total++;
    const d = new Date(l.created_at);
    if (d.getMonth() === curMonth && d.getFullYear() === curYear)
      row.thisMonth++;
    if (d.getMonth() === prevMonth && d.getFullYear() === prevMonthYear)
      row.lastMonth++;
    if (l.status === "won" || l.status === "paid") row.won++;
  }

  return ALL_SOURCES.filter((s) => sourceMap.has(s))
    .map((s) => sourceMap.get(s)!)
    .sort((a, b) => b.total - a.total);
}

export async function getCachedLeadsWithActivity() {
  "use cache";
  cacheLife("minutes");
  cacheTag("leads");

  const supabase = createServiceClient();
  const [{ data: leads }, { data: activities }] = await Promise.all([
    supabase
      .from("leads")
      .select("*")
      .order("created_at", { ascending: false }),
    supabase
      .from("lead_activities")
      .select("lead_id, created_at")
      .order("created_at", { ascending: false }),
  ]);

  const lastActivityMap: Record<string, string> = {};
  if (activities) {
    for (const a of activities) {
      if (!lastActivityMap[a.lead_id]) {
        lastActivityMap[a.lead_id] = a.created_at;
      }
    }
  }

  return { leads: leads ?? [], lastActivityMap };
}

// ── Holded API cached wrappers ───────────────────────────────────────

export async function getCachedHoldedContact(contactId: string) {
  "use cache";
  cacheLife("hours");
  cacheTag("holded-contacts", `holded-contact-${contactId}`);

  const { getContact } = await import("@/lib/holded/api");
  return getContact(contactId);
}
