import { requireRole } from "@/lib/rbac";
import { createClient } from "@/lib/supabase/server";
import UsersTable from "./users-table";

export default async function UsersPage() {
  const profile = await requireRole("super_admin");

  const supabase = await createClient();
  const { data: users } = await supabase
    .from("user_profiles")
    .select("id, email, role, is_active, created_at")
    .order("created_at", { ascending: true });

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Usuarios
      </h1>
      <UsersTable users={users ?? []} currentUserId={profile.id} />
    </div>
  );
}
