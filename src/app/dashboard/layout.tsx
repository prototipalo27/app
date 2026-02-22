import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import NotificationBell from "@/components/NotificationBell";
import MobileSidebar from "@/components/MobileSidebar";
import SessionRefresh from "@/components/SessionRefresh";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import ImpersonateButton from "@/components/ImpersonateButton";
import { getUserProfile, getRealProfile, hasRole, type UserRole } from "@/lib/rbac";
import { getImpersonatedUserId } from "@/lib/impersonate";
import { createClient } from "@/lib/supabase/server";
import DesktopNav from "./desktop-nav";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Admin",
  manager: "Manager",
  employee: "Empleado",
};

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const profile = await getUserProfile();

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  const realProfile = await getRealProfile();
  const realIsSuperAdmin = realProfile?.role === "super_admin";
  const impersonatedUserId = await getImpersonatedUserId();
  const isImpersonating = realIsSuperAdmin && impersonatedUserId && impersonatedUserId !== realProfile?.id;

  // Fetch users list for impersonation dropdown (only for super_admin)
  let impersonatableUsers: { id: string; email: string; role: string }[] = [];
  if (realIsSuperAdmin) {
    const supabase = await createClient();
    const { data } = await supabase
      .from("user_profiles")
      .select("id, email, role")
      .eq("is_active", true)
      .neq("id", realProfile!.id)
      .order("email");
    impersonatableUsers = data ?? [];
  }

  const isManager = hasRole(profile.role, "manager");
  const isSuperAdmin = profile.role === "super_admin";

  const bottomSection = (
    <>
      <div className="mb-1 flex items-center gap-2 px-3">
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-400">
          {profile.email}
        </p>
        <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
          {ROLE_LABELS[profile.role]}
        </span>
      </div>
      <Link
        href="/dashboard/requests"
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
        </svg>
        Solicitudes
      </Link>
      <div className="flex items-center gap-1">
        <NotificationBell />
        {isSuperAdmin && (
          <Link
            href="/dashboard/users"
            className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
            </svg>
            Usuarios
          </Link>
        )}
      </div>
      {realIsSuperAdmin && <ImpersonateButton users={impersonatableUsers} />}
      <form action={signOut}>
        <button
          type="submit"
          className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
          </svg>
          Sign out
        </button>
      </form>
    </>
  );

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-black">
      {/* Impersonation banner */}
      {isImpersonating && (
        <div className="fixed inset-x-0 top-0 z-50">
          <ImpersonationBanner email={profile.email} role={profile.role} />
        </div>
      )}

      {/* Mobile sidebar + top bar */}
      <MobileSidebar isManager={isManager}>{bottomSection}</MobileSidebar>

      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-white md:flex dark:border-zinc-800 dark:bg-zinc-900 ${isImpersonating ? "pt-10" : ""}`}>
        <div className="shrink-0 border-b border-zinc-200 px-5 py-3 dark:border-zinc-800">
          <Link href={isManager ? "/dashboard/control" : "/dashboard"}>
            <Image src="/logo-light.png" alt="Prototipalo" width={472} height={236} className="h-[5.25rem] w-auto dark:hidden" priority />
            <Image src="/logo-dark.png" alt="Prototipalo" width={472} height={236} className="hidden h-[5.25rem] w-auto dark:block" priority />
          </Link>
        </div>

        <DesktopNav isManager={isManager} />

        <div className="shrink-0 border-t border-zinc-200 p-2 dark:border-zinc-800">
          {bottomSection}
        </div>
      </aside>

      {/* Main content */}
      <main className={`flex min-w-0 flex-1 flex-col p-4 md:p-8 ${isImpersonating ? "pt-14 md:pt-16" : ""}`}>
        {children}
      </main>

      <SessionRefresh />
    </div>
  );
}
