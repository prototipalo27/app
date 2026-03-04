import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import CalculatorCards from "./components/calculator-cards";
import ResourceList from "./components/resource-list";

export default async function HerramientasPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>;
}) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");

  const supabase = await createClient();
  const { data: resources } = await supabase
    .from("tools_resources")
    .select("*")
    .order("position")
    .order("created_at", { ascending: false });

  const params = await searchParams;
  const tab = params.tab || "calculadoras";

  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 md:p-8">
      <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
        Herramientas
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-800">
        <a
          href="/dashboard/herramientas?tab=calculadoras"
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "calculadoras"
              ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Calculadoras
        </a>
        <a
          href="/dashboard/herramientas?tab=recursos"
          className={`border-b-2 px-4 py-2 text-sm font-medium transition ${
            tab === "recursos"
              ? "border-green-600 text-green-700 dark:border-green-400 dark:text-green-400"
              : "border-transparent text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
          }`}
        >
          Recursos
        </a>
      </div>

      {/* Content */}
      {tab === "calculadoras" && <CalculatorCards />}
      {tab === "recursos" && (
        <ResourceList resources={resources || []} isManager={isManager} />
      )}
    </div>
  );
}
