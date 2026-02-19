/**
 * Office-hour schedule utilities.
 * Office hours: Mon-Fri 09:30 – 19:00 (Europe/Madrid implied, but all
 * calculations use plain Date so the server TZ must match).
 */

const OFFICE_START_H = 9;
const OFFICE_START_M = 30;
const OFFICE_END_H = 19;
const OFFICE_END_M = 0;

/** Minutes of work available in one office day (09:30 – 19:00 = 570 min) */
const WORK_DAY_MINUTES =
  (OFFICE_END_H * 60 + OFFICE_END_M) - (OFFICE_START_H * 60 + OFFICE_START_M);

/** Is `date` within office hours? (Mon-Fri, 09:30-19:00) */
export function isOfficeHour(date: Date): boolean {
  const day = date.getDay(); // 0=Sun 6=Sat
  if (day === 0 || day === 6) return false;
  const mins = date.getHours() * 60 + date.getMinutes();
  const start = OFFICE_START_H * 60 + OFFICE_START_M;
  const end = OFFICE_END_H * 60 + OFFICE_END_M;
  return mins >= start && mins < end;
}

/** Given a moment (possibly in dead hours), return when office resumes. */
export function nextOfficeStart(date: Date): Date {
  const d = new Date(date);

  // If already in office hours, return same moment
  if (isOfficeHour(d)) return d;

  const mins = d.getHours() * 60 + d.getMinutes();
  const start = OFFICE_START_H * 60 + OFFICE_START_M;

  // If weekday and before office start → same day 09:30
  if (d.getDay() !== 0 && d.getDay() !== 6 && mins < start) {
    d.setHours(OFFICE_START_H, OFFICE_START_M, 0, 0);
    return d;
  }

  // Otherwise advance to next day and recurse
  d.setDate(d.getDate() + 1);
  d.setHours(OFFICE_START_H, OFFICE_START_M, 0, 0);
  // Skip weekends
  while (d.getDay() === 0 || d.getDay() === 6) {
    d.setDate(d.getDate() + 1);
  }
  return d;
}

/**
 * Advance `minutes` of work time from `start`, skipping dead hours.
 * Returns the wall-clock Date when the work finishes.
 */
export function addWorkMinutes(start: Date, minutes: number): Date {
  if (minutes <= 0) return new Date(start);

  let cursor = nextOfficeStart(new Date(start));
  let remaining = minutes;

  while (remaining > 0) {
    // Minutes left in the current office day
    const cursorMins = cursor.getHours() * 60 + cursor.getMinutes();
    const endOfDay = OFFICE_END_H * 60 + OFFICE_END_M;
    const availableToday = endOfDay - cursorMins;

    if (remaining <= availableToday) {
      cursor.setMinutes(cursor.getMinutes() + remaining);
      remaining = 0;
    } else {
      remaining -= availableToday;
      // Jump to next office start
      cursor.setDate(cursor.getDate() + 1);
      cursor.setHours(OFFICE_START_H, OFFICE_START_M, 0, 0);
      while (cursor.getDay() === 0 || cursor.getDay() === 6) {
        cursor.setDate(cursor.getDate() + 1);
      }
    }
  }

  return cursor;
}

/**
 * Total wall-clock minutes between two dates (simple subtraction).
 */
export function wallClockMinutes(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / 60000;
}

/**
 * Advance `minutes` of real (wall-clock) time from `start`.
 * Unlike addWorkMinutes, this does NOT skip nights or weekends — 24/7 scheduling.
 */
export function addRealMinutes(start: Date, minutes: number): Date {
  return new Date(start.getTime() + minutes * 60000);
}

/* ── Launch-window constraints ────────────────────────────────────── */

/** Launch window: 09:30 – 19:30 every day (including weekends).
 *  No new print jobs can START outside this window.
 *  Jobs already running are allowed to finish overnight. */
const LAUNCH_START_H = 9;
const LAUNCH_START_M = 30;
const LAUNCH_END_H = 19;
const LAUNCH_END_M = 30;

/** Is `date` within the launch window? (09:30 – 19:30, every day) */
export function isLaunchWindow(date: Date): boolean {
  const mins = date.getHours() * 60 + date.getMinutes();
  const start = LAUNCH_START_H * 60 + LAUNCH_START_M;
  const end = LAUNCH_END_H * 60 + LAUNCH_END_M;
  return mins >= start && mins < end;
}

/**
 * If `date` is inside the launch window, return it unchanged.
 * Otherwise return the next 09:30 (today if before 09:30, tomorrow if after 19:30).
 */
export function nextLaunchStart(date: Date): Date {
  if (isLaunchWindow(date)) return new Date(date);

  const d = new Date(date);
  const mins = d.getHours() * 60 + d.getMinutes();
  const start = LAUNCH_START_H * 60 + LAUNCH_START_M;

  if (mins < start) {
    // Before 09:30 today → same day 09:30
    d.setHours(LAUNCH_START_H, LAUNCH_START_M, 0, 0);
  } else {
    // After 19:30 → next day 09:30
    d.setDate(d.getDate() + 1);
    d.setHours(LAUNCH_START_H, LAUNCH_START_M, 0, 0);
  }
  return d;
}

export { OFFICE_START_H, OFFICE_START_M, OFFICE_END_H, OFFICE_END_M, WORK_DAY_MINUTES,
  LAUNCH_START_H, LAUNCH_START_M, LAUNCH_END_H, LAUNCH_END_M };
