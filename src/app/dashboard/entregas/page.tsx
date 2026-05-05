import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { DeliveryCalendar } from "./delivery-calendar";

export default async function DeliveriesCalendarPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();
  const now = new Date();
  const year = now.getFullYear();

  const [
    { data: projects },
    { data: holidays },
    { data: leadMeta },
  ] = await Promise.all([
    supabase
      .from("projects")
      .select("id, name, client_name, deadline, status, project_type")
      .eq("project_type", "confirmed")
      .neq("status", "delivered")
      .not("deadline", "is", null)
      .order("deadline", { ascending: true }),
    supabase
      .from("holidays")
      .select("date, name")
      .in("year", [year, year + 1]),
    supabase
      .from("app_metadata")
      .select("value")
      .eq("key", "delivery_lead_hours")
      .single(),
  ]);

  const leadHours = Number(leadMeta?.value ?? 48) || 48;
  const isManager = hasRole(profile.role, "manager");

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-zinc-900 dark:text-white">
          Calendario de entregas
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          Fechas de entrega de proyectos y margen de preparación.
        </p>
      </div>

      <DeliveryCalendar
        projects={projects ?? []}
        holidays={holidays ?? []}
        leadHours={leadHours}
        isManager={isManager}
      />
    </div>
  );
}
