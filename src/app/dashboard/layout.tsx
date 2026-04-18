import { Suspense } from "react";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { signOut } from "@/app/login/actions";
import NotificationBell from "@/components/NotificationBell";
import MobileSidebar from "@/components/MobileSidebar";
import SessionRefresh from "@/components/SessionRefresh";
import ImpersonationBanner from "@/components/ImpersonationBanner";
import BottomBar from "@/components/BottomBar";
import { getUserProfile, getRealProfile, hasRole, type UserRole } from "@/lib/rbac";
import { getImpersonatedUserId } from "@/lib/impersonate";
import { getSharedUserProfiles, getUserTaskCount } from "@/lib/supabase/cached-queries";
import DesktopNav from "./desktop-nav";

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
    <BottomBar
      email={profile.email}
      roleLabel={ROLE_LABELS[profile.role]}
      isSuperAdmin={realIsSuperAdmin}
      impersonatableUsers={impersonatableUsers}
      signOutAction={signOut}
      notificationBell={<NotificationBell />}
    />
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
