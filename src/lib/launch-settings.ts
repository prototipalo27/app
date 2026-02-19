import { SupabaseClient } from "@supabase/supabase-js";

export interface LaunchSettings {
  launchStartTime: string; // "HH:MM"
  launchEndTime: string;   // "HH:MM"
}

const DEFAULTS: LaunchSettings = {
  launchStartTime: "09:30",
  launchEndTime: "19:30",
};

/** Parse "HH:MM" → { h, m } */
export function parseTime(time: string): { h: number; m: number } {
  const [h, m] = time.split(":").map(Number);
  return { h: h || 0, m: m || 0 };
}

/** Read launch window settings from app_metadata */
export async function getLaunchSettings(supabase: SupabaseClient): Promise<LaunchSettings> {
  const { data } = await supabase
    .from("app_metadata")
    .select("key, value")
    .in("key", ["launch_start_time", "launch_end_time"]);

  const map = Object.fromEntries((data ?? []).map((r) => [r.key, r.value]));

  return {
    launchStartTime: map["launch_start_time"] ?? DEFAULTS.launchStartTime,
    launchEndTime: map["launch_end_time"] ?? DEFAULTS.launchEndTime,
  };
}

/** Is `date` within the configurable launch window? */
export function isInLaunchWindow(date: Date, settings: LaunchSettings): boolean {
  const mins = date.getHours() * 60 + date.getMinutes();
  const start = parseTime(settings.launchStartTime);
  const end = parseTime(settings.launchEndTime);
  const startMins = start.h * 60 + start.m;
  const endMins = end.h * 60 + end.m;
  return mins >= startMins && mins < endMins;
}

/** If outside launch window, return next launch start. Otherwise return date unchanged. */
export function nextLaunchStartFromSettings(date: Date, settings: LaunchSettings): Date {
  if (isInLaunchWindow(date, settings)) return new Date(date);

  const d = new Date(date);
  const start = parseTime(settings.launchStartTime);
  const mins = d.getHours() * 60 + d.getMinutes();
  const startMins = start.h * 60 + start.m;

  if (mins < startMins) {
    d.setHours(start.h, start.m, 0, 0);
  } else {
    d.setDate(d.getDate() + 1);
    d.setHours(start.h, start.m, 0, 0);
  }
  return d;
}
