import { createClient } from "@/lib/supabase/server";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import PurchaseItemsView from "./purchase-items-view";

export default async function PurchasesPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");
  const supabase = await createClient();

  // Fetch all items with creator email and project name
  const { data: items } = await supabase
    .from("purchase_items")
    .select("*, project:projects(id, name)")
    .order("created_at", { ascending: false });

  // Fetch projects for the dropdown
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name")
    .order("name");

  // Get creator emails
  const creatorIds = [
    ...new Set(
      (items || [])
        .map((i) => i.created_by)
        .filter((id): id is string => id != null)
    ),
  ];
  let creatorsMap: Record<string, string> = {};
  if (creatorIds.length > 0) {
    const { data: profiles } = await supabase
      .from("user_profiles")
      .select("id, email")
      .in("id", creatorIds);
    if (profiles) {
      creatorsMap = Object.fromEntries(
        profiles.map((p) => [p.id, p.email.split("@")[0]])
      );
    }
  }

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Compras
      </h1>
      <PurchaseItemsView
        items={(items || []).map((item) => ({
          ...item,
          creator_name: item.created_by
            ? creatorsMap[item.created_by] || "—"
            : "—",
          project_name: item.project?.name || null,
        }))}
        projects={projects || []}
        isManager={isManager}
        userId={profile.id}
      />
    </div>
  );
}
