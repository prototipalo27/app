import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import SkillEditor from "./skill-editor";
import LinkStop from "./link-stop";
import WorkCalendar from "./work-calendar";
import ZoneEditor from "./zone-editor";
import { getZoneColor, getZoneLabel } from "@/lib/zones";

const ROLE_COLORS: Record<string, string> = {
  super_admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  employee:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Super Admin",
  manager: "Manager",
  employee: "Empleado",
};

const SKILL_COLORS = [
  "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
];

function getSkillColor(index: number) {
  return SKILL_COLORS[index % SKILL_COLORS.length];
}

function parseBirthday(birthday: string | null): { month: number; day: number } | null {
  if (!birthday) return null;
  const parts = birthday.split("-");
  if (parts.length !== 2) return null;
  const month = parseInt(parts[0], 10);
  const day = parseInt(parts[1], 10);
  if (!month || !day) return null;
  return { month, day };
}

function isBirthdaySoon(birthday: string | null): boolean {
  const bd = parseBirthday(birthday);
  if (!bd) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const thisYear = today.getFullYear();
  let target = new Date(thisYear, bd.month - 1, bd.day);
  if (target < today) {
    target = new Date(thisYear + 1, bd.month - 1, bd.day);
  }
  const diff = (target.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  return diff >= 0 && diff <= 7;
}

function formatBirthday(birthday: string | null): string | null {
  const bd = parseBirthday(birthday);
  if (!bd) return null;
  const d = new Date(2000, bd.month - 1, bd.day);
  return d.toLocaleDateString("es-ES", { day: "numeric", month: "short" });
}

export default async function EquipoPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  const currentYear = new Date().getFullYear();

  const [
    { data: users },
    { data: skills },
    { data: userSkills },
    { data: zoneAssignments },
    { data: holidays },
    { data: timeOffRequests },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, email, role, is_active, full_name, nickname, birthday, hire_date")
      .eq("is_active", true)
      .order("email"),
    supabase.from("skills").select("id, name").order("name"),
    supabase.from("user_skills").select("user_id, skill_id"),
    supabase.from("zone_assignments").select("user_id, zone"),
    supabase.from("holidays").select("*").eq("year", currentYear).order("date"),
    supabase
      .from("time_off_requests")
      .select("id, user_id, start_date, end_date, type, status, notes, approved_by, created_at, updated_at")
      .gte("start_date", `${currentYear}-01-01`)
      .lte("end_date", `${currentYear}-12-31`)
      .order("start_date"),
  ]);

  // Enrich time off requests with user info
  const allUsers = users ?? [];
  const userLookup = new Map(allUsers.map((u) => [u.id, u]));
  const enrichedTimeOff = (timeOffRequests ?? []).map((r) => {
    const user = userLookup.get(r.user_id);
    return {
      ...r,
      user: user ? { id: user.id, full_name: user.full_name, nickname: user.nickname, email: user.email } : null,
      approver: null as { full_name: string | null } | null,
    };
  });

  const allSkills = skills ?? [];
  const skillMap = new Map(allSkills.map((s) => [s.id, s.name]));
  const skillColorMap = new Map(allSkills.map((s, i) => [s.id, getSkillColor(i)]));

  const userSkillMap = new Map<string, string[]>();
  for (const us of userSkills ?? []) {
    const arr = userSkillMap.get(us.user_id) ?? [];
    arr.push(us.skill_id);
    userSkillMap.set(us.user_id, arr);
  }

  const userZoneMap = new Map<string, string[]>();
  for (const za of zoneAssignments ?? []) {
    const arr = userZoneMap.get(za.user_id) ?? [];
    arr.push(za.zone);
    userZoneMap.set(za.user_id, arr);
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Equipo
      </h1>

      <WorkCalendar
        holidays={holidays ?? []}
        timeOffRequests={enrichedTimeOff}
        isManager={isManager}
        currentUserId={profile.id}
        year={currentYear}
      />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(users ?? []).map((user) => {
          const displayName = user.nickname || user.full_name || user.email.split("@")[0];
          const skillIds = userSkillMap.get(user.id) ?? [];
          const zoneIds = userZoneMap.get(user.id) ?? [];
          const birthdaySoon = isBirthdaySoon(user.birthday);
          const birthdayStr = formatBirthday(user.birthday);

          return (
            <Link
              key={user.id}
              href={`/dashboard/equipo/${user.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-semibold capitalize text-zinc-900 dark:text-white">
                  {displayName}
                </h3>
                <span
                  className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>

              {birthdayStr && (
                <div className="mt-1.5 flex items-center gap-1 text-xs text-zinc-500 dark:text-zinc-400">
                  {birthdaySoon && (
                    <span className="inline-block h-2 w-2 rounded-full bg-amber-400 animate-pulse" />
                  )}
                  <span>{birthdayStr}</span>
                </div>
              )}

              <div className="mt-3 flex flex-wrap gap-1">
                {skillIds.length === 0 && (
                  <span className="text-xs text-zinc-400">Sin skills asignados</span>
                )}
                {skillIds.map((sid) => (
                  <span
                    key={sid}
                    className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${skillColorMap.get(sid) ?? SKILL_COLORS[0]}`}
                  >
                    {skillMap.get(sid)}
                  </span>
                ))}
              </div>

              {zoneIds.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {zoneIds.map((zone) => (
                    <span
                      key={zone}
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${getZoneColor(zone)}`}
                    >
                      {getZoneLabel(zone)}
                    </span>
                  ))}
                </div>
              )}

              {isManager && (
                <LinkStop>
                  <ZoneEditor userId={user.id} userZones={zoneIds} />
                  <SkillEditor
                    userId={user.id}
                    allSkills={allSkills}
                    userSkillIds={skillIds}
                  />
                </LinkStop>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
