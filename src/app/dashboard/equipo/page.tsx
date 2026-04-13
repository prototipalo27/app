import { createClient } from "@/lib/supabase/server";
import { getUserProfile, getRealProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import Link from "next/link";
import SkillEditor from "./skill-editor";
import LinkStop from "./link-stop";
import WorkCalendar from "./work-calendar";
import ZoneEditor from "./zone-editor";
import OvertimeSection from "./overtime-section";
import AdminSection from "./admin-section";
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

function contractBadge(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (daysLeft <= 30) return { label: `${daysLeft}d`, className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (daysLeft <= 90) return { label: `${daysLeft}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  return { label: `${daysLeft}d`, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

function formatTenure(hireDate: string | null): string | null {
  if (!hireDate) return null;
  const hire = new Date(hireDate);
  const now = new Date();
  const months = (now.getFullYear() - hire.getFullYear()) * 12 + (now.getMonth() - hire.getMonth());
  if (months < 1) return "< 1 mes";
  if (months < 12) return `${months} ${months === 1 ? "mes" : "meses"}`;
  const years = Math.floor(months / 12);
  const rem = months % 12;
  if (rem === 0) return `${years} ${years === 1 ? "año" : "años"}`;
  return `${years}a ${rem}m`;
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

  const realProfile = await getRealProfile();
  const isImpersonating = realProfile != null && realProfile.id !== profile.id;
  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  const isSuperAdmin = hasRole(profile.role, "super_admin");
  const currentYear = new Date().getFullYear();

  const [
    { data: users },
    { data: skills },
    { data: userSkills },
    { data: zoneAssignments },
    { data: holidays },
    { data: timeOffRequests },
    { data: overtimeEntries },
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
    isManager
      ? supabase.from("overtime_entries").select("user_id, minutes, type")
      : Promise.resolve({ data: null }),
  ]);

  // Fetch extra fields not in generated types (phone, contract_end_date)
  const { data: extraFields } = await (supabase as any)
    .from("user_profiles")
    .select("id, phone, contract_end_date")
    .eq("is_active", true);
  const extraMap = new Map<string, { phone: string | null; contract_end_date: string | null }>(
    ((extraFields ?? []) as { id: string; phone: string | null; contract_end_date: string | null }[])
      .map((e) => [e.id, e])
  );

  // Fetch ALL users for admin section (including inactive + contract_end_date)
  let adminUsers: { id: string; email: string; role: string; is_active: boolean; full_name: string | null; contract_end_date: string | null }[] = [];
  if (isSuperAdmin) {
    const { data: allProfiles } = await (supabase as any)
      .from("user_profiles")
      .select("id, email, role, is_active, full_name, contract_end_date")
      .order("created_at", { ascending: true });
    adminUsers = (allProfiles ?? []) as typeof adminUsers;
  }

  // Build overtime balance map (manager only)
  const overtimeBalances = new Map<string, number>();
  if (isManager && overtimeEntries) {
    for (const entry of overtimeEntries) {
      const current = overtimeBalances.get(entry.user_id) ?? 0;
      overtimeBalances.set(
        entry.user_id,
        current + (entry.type === "earned" ? entry.minutes : -entry.minutes)
      );
    }
  }

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

      {/* Admin section — super_admin only */}
      {isSuperAdmin && (
        <AdminSection users={adminUsers} currentUserId={profile.id} />
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(users ?? []).map((user) => {
          const displayName = user.nickname || user.full_name || user.email.split("@")[0];
          const initials = (user.full_name || user.email.split("@")[0])
            .split(" ")
            .map((w: string) => w[0])
            .slice(0, 2)
            .join("")
            .toUpperCase();
          const skillIds = userSkillMap.get(user.id) ?? [];
          const zoneIds = userZoneMap.get(user.id) ?? [];
          const overtimeMinutes = overtimeBalances.get(user.id) ?? 0;
          const birthdaySoon = isBirthdaySoon(user.birthday);
          const birthdayStr = formatBirthday(user.birthday);
          const tenure = formatTenure(user.hire_date);
          const extra = extraMap.get(user.id);
          const contract = contractBadge(extra?.contract_end_date ?? null);

          return (
            <Link
              key={user.id}
              href={`/dashboard/equipo/${user.id}`}
              className="group rounded-xl border border-zinc-200 bg-white p-4 transition-colors hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
            >
              {/* Header: avatar + name + role */}
              <div className="flex items-center gap-3">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-sm font-bold ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}>
                  {initials}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <h3 className="truncate text-sm font-semibold text-zinc-900 dark:text-white">
                      {displayName}
                    </h3>
                    {birthdaySoon && (
                      <span className="inline-block h-2 w-2 shrink-0 rounded-full bg-amber-400 animate-pulse" title="Cumpleaños pronto" />
                    )}
                  </div>
                  <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">{user.email}</p>
                </div>
                <span
                  className={`shrink-0 rounded px-2 py-0.5 text-[10px] font-semibold ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}
                >
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </div>

              {/* Info row: tenure, birthday, phone */}
              <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-zinc-500 dark:text-zinc-400">
                {tenure && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                    </svg>
                    {tenure}
                  </span>
                )}
                {birthdayStr && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 15.546c-.523 0-1.046.151-1.5.454a2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0 2.704 2.704 0 00-3 0 2.704 2.704 0 01-3 0A1.75 1.75 0 003 15.546M12 3v1m0 11v1m-4.93-9.07l.707.707M5.05 14.95l.707.707M3 10h1m11 0h1m-2.05-4.364l.707-.707M18.95 14.95l-.707.707" />
                    </svg>
                    {birthdayStr}
                  </span>
                )}
                {extra?.phone && (
                  <span className="flex items-center gap-1">
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                    </svg>
                    {extra.phone}
                  </span>
                )}
              </div>

              {/* Contract end date */}
              {contract && (
                <div className="mt-2.5 flex items-center gap-1.5">
                  <svg className="h-3 w-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Contrato</span>
                  <span className={`rounded px-1.5 py-0.5 text-[10px] font-semibold ${contract.className}`}>
                    {contract.label}
                  </span>
                  <span className="text-[10px] text-zinc-400">
                    {new Date(extra!.contract_end_date!).toLocaleDateString("es-ES", { day: "numeric", month: "short" })}
                  </span>
                </div>
              )}

              {/* Overtime (managers only) */}
              {isManager && overtimeMinutes !== 0 && (
                <div className="mt-2 flex items-center gap-1.5">
                  <svg className="h-3 w-3 text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-xs text-zinc-500 dark:text-zinc-400">Horas extra</span>
                  <span className={`text-xs font-semibold ${overtimeMinutes > 0 ? "text-green-600 dark:text-green-400" : "text-red-500 dark:text-red-400"}`}>
                    {overtimeMinutes > 0 ? "+" : ""}{Math.floor(Math.abs(overtimeMinutes) / 60) > 0 ? `${Math.floor(Math.abs(overtimeMinutes) / 60)}h` : ""}{Math.abs(overtimeMinutes) % 60 > 0 ? ` ${Math.abs(overtimeMinutes) % 60}min` : ""}
                  </span>
                </div>
              )}

              {/* Divider + Skills & Zones */}
              <div className="mt-3 border-t border-zinc-100 pt-3 dark:border-zinc-800">
                <div className="flex flex-wrap gap-1">
                  {skillIds.map((sid) => (
                    <span
                      key={sid}
                      className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${skillColorMap.get(sid) ?? SKILL_COLORS[0]}`}
                    >
                      {skillMap.get(sid)}
                    </span>
                  ))}
                  {zoneIds.map((zone) => (
                    <span
                      key={zone}
                      className={`inline-block rounded px-1.5 py-0.5 text-[10px] font-semibold ${getZoneColor(zone)}`}
                    >
                      {getZoneLabel(zone)}
                    </span>
                  ))}
                  {skillIds.length === 0 && zoneIds.length === 0 && (
                    <span className="text-[10px] text-zinc-400">Sin skills ni zonas</span>
                  )}
                </div>
              </div>

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

      <WorkCalendar
        holidays={holidays ?? []}
        timeOffRequests={enrichedTimeOff}
        isManager={isManager}
        currentUserId={profile.id}
        year={currentYear}
      />

      <OvertimeSection
        isManager={isManager}
        isImpersonating={isImpersonating}
        currentUserId={profile.id}
        users={allUsers.map((u) => ({
          id: u.id,
          full_name: u.full_name,
          nickname: u.nickname,
          email: u.email,
        }))}
      />
    </div>
  );
}
