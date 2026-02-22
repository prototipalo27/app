"use client";

import { usePathname } from "next/navigation";
import Link from "next/link";

function NavLink({ href, label, icon, exact = false, alsoMatch, actionHref, actionIcon, actionTitle, actions, badge }: { href: string; label: string; icon: React.ReactNode; exact?: boolean; alsoMatch?: string; actionHref?: string; actionIcon?: React.ReactNode; actionTitle?: string; actions?: { href: string; icon: React.ReactNode; title: string }[]; badge?: number }) {
  const pathname = usePathname();
  const isActive = (exact ? pathname === href : pathname?.startsWith(href)) || (alsoMatch && pathname?.startsWith(alsoMatch));
  const isActionActive = actionHref && pathname?.startsWith(actionHref);

  const allActions = actions || (actionHref ? [{ href: actionHref, icon: actionIcon!, title: actionTitle! }] : []);

  return (
    <div className="flex items-center gap-0.5">
      <Link
        href={href}
        className={`flex flex-1 items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium ${
          isActive
            ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
            : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
        }`}
      >
        {icon}
        {label}
        {badge != null && badge > 0 && (
          <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-green-600 px-1.5 text-[10px] font-bold text-white">
            {badge}
          </span>
        )}
      </Link>
      {allActions.map((action) => {
        const active = pathname?.startsWith(action.href);
        return (
          <Link
            key={action.href}
            href={action.href}
            className={`flex items-center rounded-lg p-2 ${
              active
                ? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-white"
                : "text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            }`}
            title={action.title}
          >
            {action.icon}
          </Link>
        );
      })}
    </div>
  );
}

function SectionLabel({ label }: { label: string }) {
  return (
    <>
      <div className="my-1 border-t border-zinc-200 dark:border-zinc-800" />
      <p className="px-3 py-0.5 text-xs font-semibold uppercase tracking-wider text-zinc-400 dark:text-zinc-500">
        {label}
      </p>
    </>
  );
}

export default function DesktopNav({ isManager, pendingTaskCount = 0 }: { isManager: boolean; pendingTaskCount?: number }) {
  return (
    <nav className="flex-1 space-y-0.5 overflow-hidden p-3">
      {/* ── VENTAS ── */}
      {isManager && (
        <>
          <SectionLabel label="Ventas" />
          <NavLink
            href="/dashboard/crm"
            label="Leads"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
            }
            actions={[
              {
                href: "/dashboard/settings/email-snippets",
                title: "Frases de email",
                icon: (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" />
                  </svg>
                ),
              },
              {
                href: "/dashboard/settings/email",
                title: "Mi cuenta de email",
                icon: (
                  <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                ),
              },
            ]}
          />
        </>
      )}

      {/* ── PRODUCCIÓN ── */}
      <SectionLabel label="Producción" />
      <NavLink
        href="/dashboard"
        exact
        alsoMatch="/dashboard/projects"
        label="Proyectos"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
          </svg>
        }
        actionHref={isManager ? "/dashboard/settings/templates" : undefined}
        actionTitle="Plantillas"
        actionIcon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
          </svg>
        }
      />
      <NavLink
        href="/dashboard/printers"
        label="Impresoras"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z" />
          </svg>
        }
        actionHref="/dashboard/queue"
        actionTitle="Cola de impresión"
        actionIcon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
          </svg>
        }
      />
      <NavLink
        href="/dashboard/shipments"
        label="Envíos"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
          </svg>
        }
      />

      {/* ── TAREAS ── */}
      <SectionLabel label="Tareas" />
      <NavLink
        href="/dashboard/tareas"
        label="Tareas"
        badge={pendingTaskCount}
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
          </svg>
        }
      />

      {/* ── EQUIPO ── */}
      <SectionLabel label="Equipo" />
      <NavLink
        href="/dashboard/equipo"
        label="Equipo"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z" />
          </svg>
        }
      />

      {/* ── COMPRAS ── */}
      <SectionLabel label="Compras" />
      <NavLink
        href="/dashboard/purchases"
        label="Compras"
        icon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 3h2l.4 2M7 13h10l4-8H5.4M7 13L5.4 5M7 13l-2.293 2.293c-.63.63-.184 1.707.707 1.707H17m0 0a2 2 0 100 4 2 2 0 000-4zm-8 2a2 2 0 100 4 2 2 0 000-4z" />
          </svg>
        }
        actionHref={isManager ? "/dashboard/suppliers" : undefined}
        actionTitle="Proveedores"
        actionIcon={
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
        }
      />

      {/* ── FINANZAS ── */}
      {isManager && (
        <>
          <SectionLabel label="Finanzas" />
          <NavLink
            href="/dashboard/finanzas"
            exact
            label="Finanzas"
            icon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            }
            actionHref="/dashboard/finanzas/extracto"
            actionTitle="Extracto bancario"
            actionIcon={
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
            }
          />
        </>
      )}

    </nav>
  );
}
