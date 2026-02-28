import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import SkillEditor from "../skill-editor";
import EmployeeProfileForm from "./employee-profile-form";
import EmployeeDocuments from "./employee-documents";
import CareerPlanEditor from "./career-plan-editor";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  const [
    { data: employee },
    { data: skills },
    { data: userSkills },
    { data: documents },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("*")
      .eq("id", id)
      .single(),
    supabase.from("skills").select("id, name").order("name"),
    supabase.from("user_skills").select("user_id, skill_id").eq("user_id", id),
    supabase
      .from("employee_documents")
      .select("*")
      .eq("user_id", id)
      .order("uploaded_at", { ascending: false }),
  ]);

  if (!employee) notFound();

  const allSkills = skills ?? [];
  const userSkillIds = (userSkills ?? []).map((us) => us.skill_id);
  const displayName = employee.nickname || employee.full_name || employee.email.split("@")[0];

  return (
    <div className="mx-auto max-w-4xl p-4 md:p-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link
          href="/dashboard/equipo"
          className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-600 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
        >
          <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </Link>
        <div>
          <h1 className="text-2xl font-bold capitalize text-zinc-900 dark:text-white">
            {displayName}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">{employee.email}</p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Section 1: Personal Info */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Informacion personal
          </h2>
          <EmployeeProfileForm
            employee={{
              id: employee.id,
              full_name: employee.full_name,
              nickname: employee.nickname,
              birthday: employee.birthday,
              phone: employee.phone,
              hire_date: employee.hire_date,
            }}
            isManager={isManager}
          />
        </section>

        {/* Section 2: Skills */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Skills
          </h2>
          {userSkillIds.length === 0 && !isManager && (
            <p className="text-sm text-zinc-400">Sin skills asignados</p>
          )}
          {userSkillIds.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-1.5">
              {userSkillIds.map((sid) => {
                const skill = allSkills.find((s) => s.id === sid);
                return (
                  <span
                    key={sid}
                    className="inline-block rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400"
                  >
                    {skill?.name}
                  </span>
                );
              })}
            </div>
          )}
          {isManager && (
            <SkillEditor
              userId={employee.id}
              allSkills={allSkills}
              userSkillIds={userSkillIds}
            />
          )}
        </section>

        {/* Section 3: Documents */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Documentos
          </h2>
          <EmployeeDocuments
            userId={employee.id}
            employeeName={displayName}
            documents={documents ?? []}
            isManager={isManager}
          />
        </section>

        {/* Section 4: Career Plan */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Plan de carrera
          </h2>
          <CareerPlanEditor
            userId={employee.id}
            careerPlan={employee.career_plan}
            isManager={isManager}
          />
        </section>
      </div>
    </div>
  );
}
