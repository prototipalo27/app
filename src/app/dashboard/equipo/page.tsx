import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import SkillEditor from "./skill-editor";

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

export default async function EquipoPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  const [{ data: users }, { data: skills }, { data: userSkills }] =
    await Promise.all([
      supabase
        .from("user_profiles")
        .select("id, email, role, is_active")
        .eq("is_active", true)
        .order("email"),
      supabase.from("skills").select("id, name").order("name"),
      supabase.from("user_skills").select("user_id, skill_id"),
    ]);

  const allSkills = skills ?? [];
  const skillMap = new Map(allSkills.map((s) => [s.id, s.name]));
  const skillColorMap = new Map(allSkills.map((s, i) => [s.id, getSkillColor(i)]));

  const userSkillMap = new Map<string, string[]>();
  for (const us of userSkills ?? []) {
    const arr = userSkillMap.get(us.user_id) ?? [];
    arr.push(us.skill_id);
    userSkillMap.set(us.user_id, arr);
  }

  return (
    <div className="mx-auto max-w-6xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Equipo
      </h1>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {(users ?? []).map((user) => {
          const displayName = user.email.split("@")[0];
          const skillIds = userSkillMap.get(user.id) ?? [];

          return (
            <div
              key={user.id}
              className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900"
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

              {isManager && (
                <SkillEditor
                  userId={user.id}
                  allSkills={allSkills}
                  userSkillIds={skillIds}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
