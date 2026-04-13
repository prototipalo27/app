import { Suspense } from "react";
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
import { getSharedUserProfiles, getUserTaskCount } from "@/lib/supabase/cached-queries";
import DesktopNav from "./desktop-nav";
import ThemeToggle from "@/components/ThemeToggle";

const ROLE_LABELS: Record<UserRole, string> = {
  super_admin: "Admin",
  manager: "Manager",
  employee: "Empleado",
  comercial: "Comercial",
};

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
      <AuthenticatedDashboard>{children}</AuthenticatedDashboard>
    </Suspense>
  );
}

function DashboardSkeleton() {
  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 md:flex-row dark:bg-black">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 md:flex dark:border-zinc-800 dark:bg-zinc-950">
        <div className="shrink-0 border-b border-zinc-200/80 px-5 py-3 dark:border-zinc-800/50">
          <div className="h-[5.25rem] w-40 animate-pulse rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="flex-1 p-3 space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-8 rounded-lg bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
          ))}
        </div>
      </aside>
      <main className="flex min-w-0 flex-1 flex-col p-4 md:p-8">
        <div className="h-8 w-48 rounded bg-zinc-200 dark:bg-zinc-800 animate-pulse" />
      </main>
    </div>
  );
}

async function AuthenticatedDashboard({
  children,
}: {
  children: React.ReactNode;
}) {
  // Parallelize auth calls (these need cookies, can't be cached)
  const [profile, realProfile, impersonatedUserId] = await Promise.all([
    getUserProfile(),
    getRealProfile(),
    getImpersonatedUserId(),
  ]);

  if (!profile || !profile.is_active) {
    redirect("/login");
  }

  const realIsSuperAdmin = realProfile?.role === "super_admin";
  const isImpersonating = realIsSuperAdmin && impersonatedUserId && impersonatedUserId !== realProfile?.id;

  // Cached queries: task count (minutes) + user profiles for impersonation (hours)
  const [pendingTaskCount, sharedProfiles] = await Promise.all([
    getUserTaskCount(profile.id),
    realIsSuperAdmin ? getSharedUserProfiles() : Promise.resolve([]),
  ]);

  const impersonatableUsers = realIsSuperAdmin
    ? sharedProfiles
        .filter((u) => u.id !== realProfile!.id)
        .map((u) => ({ id: u.id, email: u.email, role: u.role }))
    : [];

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
      <div className="flex items-center gap-1">
        <NotificationBell />
        <Link
          href={`/dashboard/equipo/${profile.id}`}
          className="flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          title="Mi perfil y ajustes"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </Link>
      </div>
      <ThemeToggle />
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
      <MobileSidebar isManager={isManager} isSuperAdmin={isSuperAdmin} pendingTaskCount={pendingTaskCount}>{bottomSection}</MobileSidebar>

      {/* Desktop sidebar */}
      <aside className={`sticky top-0 hidden h-screen w-64 shrink-0 flex-col border-r border-zinc-200 bg-zinc-50 md:flex dark:border-zinc-800 dark:bg-zinc-950 ${isImpersonating ? "pt-10" : ""}`}>
        <div className="shrink-0 border-b border-zinc-200/80 px-5 py-3 dark:border-zinc-800/50">
          <Link href={isManager ? "/dashboard/control" : "/dashboard"}>
            <Image src="/logo-light.png" alt="Prototipalo" width={160} height={80} className="h-[5.25rem] w-auto dark:hidden" priority />
            <Image src="/logo-dark.png" alt="Prototipalo" width={160} height={80} className="hidden h-[5.25rem] w-auto dark:block" priority />
          </Link>
        </div>

        <DesktopNav isManager={isManager} isSuperAdmin={isSuperAdmin} pendingTaskCount={pendingTaskCount} />

        <div className="shrink-0 border-t border-zinc-200/80 p-2 dark:border-zinc-800/50">
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
