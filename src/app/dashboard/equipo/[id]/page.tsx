import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { notFound } from "next/navigation";
import Link from "next/link";
import SkillEditor from "../skill-editor";
import EmployeeProfileForm from "./employee-profile-form";
import EmployeeDocuments from "./employee-documents";
import CareerPlanEditor from "./career-plan-editor";
import EmployeeCommissions from "./employee-commissions";
import EmployeeFixedExpenses from "./employee-fixed-expenses";
import EmployeeOvertime from "./employee-overtime";
import EmployeeCalendar from "./employee-calendar";
import ImprovementNotes, { type ImprovementNote } from "./improvement-notes";
import NotificationSettingsClient from "../../settings/notifications/notification-settings-client";
import {
  getNotificationEvents,
  getMyNotificationPreferences,
  getActiveUsers,
} from "../../settings/notifications/actions";

export default async function EmployeeDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");
  const isOwnProfile = profile.id === id;
  const canSeeOvertime = isOwnProfile || isManager;
  const currentYear = new Date().getFullYear();
  const supabase = await createClient();

  const [
    { data: employee },
    { data: skills },
    { data: userSkills },
    { data: documents },
    { data: employeeExpenses },
    { data: overtimeRaw },
    { data: timeOffRaw },
    { data: holidaysRaw },
    { data: improvementNotesRaw },
  ] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("id, full_name, nickname, email, birthday, phone, hire_date, career_plan")
      .eq("id", id)
      .single(),
    supabase.from("skills").select("id, name").order("name"),
    supabase.from("user_skills").select("user_id, skill_id").eq("user_id", id),
    supabase
      .from("employee_documents")
      .select("id, file_name, file_path, document_type, uploaded_at, notes")
      .eq("user_id", id)
      .order("uploaded_at", { ascending: false }),
    isManager
      ? supabase
          .from("fixed_expenses")
          .select("id, name, category, amount, frequency, day_of_month, notes, start_date, end_date")
          .eq("employee_id", id)
          .eq("is_active", true)
          .order("category")
          .order("name")
      : Promise.resolve({ data: null }),
    canSeeOvertime
      ? supabase
          .from("overtime_entries")
          .select("id, user_id, date, minutes, reason, type, created_at")
          .eq("user_id", id)
          .order("date", { ascending: false })
      : Promise.resolve({ data: null }),
    supabase
      .from("time_off_requests")
      .select("id, start_date, end_date, type, status, notes")
      .eq("user_id", id)
      .order("start_date", { ascending: false }),
    supabase
      .from("holidays")
      .select("id, date, name, scope")
      .eq("year", currentYear)
      .order("date"),
    isManager
      ? supabase
          .from("employee_improvement_notes")
          .select("id, content, created_at, created_by, resolved_at, resolved_by")
          .eq("user_id", id)
          .order("created_at", { ascending: false })
      : Promise.resolve({ data: null }),
  ]);

  if (!employee) notFound();

  const allSkills = skills ?? [];
  const userSkillIds = (userSkills ?? []).map((us) => us.skill_id);
  const displayName = employee.nickname || employee.full_name || employee.email.split("@")[0];

  const overtimeEntries = overtimeRaw ?? [];
  const overtimeBalance = overtimeEntries.reduce(
    (acc, e) => acc + (e.type === "earned" ? e.minutes : -e.minutes),
    0,
  );
  const timeOffRequests = timeOffRaw ?? [];
  const holidays = holidaysRaw ?? [];

  const improvementNotes: ImprovementNote[] = improvementNotesRaw ?? [];
  const noteAuthorIds = Array.from(
    new Set(
      improvementNotes
        .flatMap((n) => [n.created_by, n.resolved_by])
        .filter((v): v is string => !!v),
    ),
  );
  const noteUserMap: Record<string, string> = {};
  if (noteAuthorIds.length > 0) {
    const { data: noteAuthors } = await supabase
      .from("user_profiles")
      .select("id, nickname, email")
      .in("id", noteAuthorIds);
    for (const u of noteAuthors ?? []) {
      noteUserMap[u.id] = u.nickname || u.email.split("@")[0];
    }
  }

  // Only load notification settings for the user's own profile
  let notifEvents: any[] = [];
  let notifPrefs: any[] = [];
  let notifUsers: any[] = [];
  if (isOwnProfile) {
    const [ev, pr, us] = await Promise.all([
      getNotificationEvents(),
      getMyNotificationPreferences(),
      isManager ? getActiveUsers() : Promise.resolve({ data: null }),
    ]);
    notifEvents = ev.data ?? [];
    notifPrefs = pr.data ?? [];
    notifUsers = us.data ?? [];
  }

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

        {/* Section 1.5: Calendar & vacations */}
        <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
          <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            Calendario y vacaciones
          </h2>
          <EmployeeCalendar
            isOwnProfile={isOwnProfile}
            timeOff={timeOffRequests}
            holidays={holidays}
            year={currentYear}
          />
        </section>

        {/* Section 1.6: Overtime — own profile or manager only */}
        {canSeeOvertime && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Horas extra
            </h2>
            <EmployeeOvertime
              isOwnProfile={isOwnProfile}
              initialBalance={overtimeBalance}
              initialEntries={overtimeEntries}
            />
          </section>
        )}

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

        {/* Section 2.5: Improvement notes / 1-on-1 prep (managers only) */}
        {isManager && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-1 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Puntos de mejora
            </h2>
            <p className="mb-4 text-xs text-zinc-400 dark:text-zinc-500">
              Para tratar en la próxima 1-on-1.
            </p>
            <ImprovementNotes
              userId={employee.id}
              notes={improvementNotes}
              userMap={noteUserMap}
            />
          </section>
        )}

        {/* Section 3: Commissions (managers only) */}
        {isManager && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Comisiones
            </h2>
            <EmployeeCommissions userId={employee.id} employeeName={displayName} />
          </section>
        )}

        {/* Section 3.5: Fixed expenses (managers only) */}
        {isManager && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Gastos fijos
            </h2>
            <EmployeeFixedExpenses
              employeeId={employee.id}
              expenses={employeeExpenses ?? []}
            />
          </section>
        )}

        {/* Section 4: Documents */}
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

        {/* Section 5: Career Plan */}
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

        {/* Section 6: Notification settings — own profile only */}
        {isOwnProfile && (
          <section className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
            <h2 className="mb-4 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
              Notificaciones
            </h2>
            <NotificationSettingsClient
              events={notifEvents}
              preferences={notifPrefs}
              users={notifUsers}
              currentUserRole={profile.role}
              isManager={isManager}
            />
          </section>
        )}
      </div>
    </div>
  );
}
