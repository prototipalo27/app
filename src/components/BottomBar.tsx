"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { startImpersonating } from "@/lib/impersonate";

interface BottomBarProps {
  email: string;
  roleLabel: string;
  isSuperAdmin: boolean;
  impersonatableUsers: { id: string; email: string; role: string }[];
  signOutAction: () => Promise<void>;
  notificationBell: React.ReactNode;
}

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  manager: "Manager",
  employee: "Empleado",
  comercial: "Comercial",
};

export default function BottomBar({
  email,
  roleLabel,
  isSuperAdmin,
  impersonatableUsers,
  signOutAction,
  notificationBell,
}: BottomBarProps) {
  const [showSignOut, setShowSignOut] = useState(false);
  const [showImpersonate, setShowImpersonate] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const signOutRef = useRef<HTMLDivElement>(null);
  const impersonateRef = useRef<HTMLDivElement>(null);
  const settingsRef = useRef<HTMLDivElement>(null);
  const settingsTimeout = useRef<NodeJS.Timeout | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (signOutRef.current && !signOutRef.current.contains(e.target as Node)) {
        setShowSignOut(false);
      }
      if (impersonateRef.current && !impersonateRef.current.contains(e.target as Node)) {
        setShowImpersonate(false);
      }
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div className="space-y-1">
      {/* Email + role row */}
      <div className="flex items-center gap-2 px-1">
        <div className="relative min-w-0 flex-1" ref={signOutRef}>
          <button
            type="button"
            onClick={() => { setShowSignOut((v) => !v); setShowImpersonate(false); }}
            className="block truncate text-xs text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
          >
            {email}
          </button>
          {showSignOut && (
            <div className="absolute bottom-full left-0 z-50 mb-1 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              <form action={signOutAction}>
                <button
                  type="submit"
                  className="flex w-full items-center gap-2 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 dark:text-red-400 dark:hover:bg-red-900/20"
                >
                  <svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                  Cerrar sesion
                </button>
              </form>
            </div>
          )}
        </div>

        {isSuperAdmin && impersonatableUsers.length > 0 ? (
          <div className="relative" ref={impersonateRef}>
            <button
              type="button"
              onClick={() => { setShowImpersonate((v) => !v); setShowSignOut(false); }}
              className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
            >
              {roleLabel}
            </button>
            {showImpersonate && (
              <div className="absolute bottom-full right-0 z-50 mb-1 w-56 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
                <div className="max-h-60 overflow-y-auto p-1">
                  <p className="px-2 py-1 text-[10px] font-medium uppercase text-zinc-400">Ver como...</p>
                  {impersonatableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={async () => {
                        await startImpersonating(u.id);
                        setShowImpersonate(false);
                        router.refresh();
                      }}
                      className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-zinc-100 dark:hover:bg-zinc-700"
                    >
                      <span className="truncate text-zinc-700 dark:text-zinc-200">
                        {u.email.split("@")[0]}
                      </span>
                      <span className="ml-2 shrink-0 text-[10px] text-zinc-400">
                        {ROLE_LABELS[u.role] ?? u.role}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : (
          <span className="shrink-0 rounded bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400">
            {roleLabel}
          </span>
        )}
      </div>

      {/* Action row: notifications + requests + settings */}
      <div className="flex items-center gap-0.5 px-1">
        {notificationBell}
        <Link
          href="/dashboard/requests"
          className="flex items-center rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
          title="Solicitudes"
        >
          <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
          </svg>
        </Link>
        <div
          className="group relative"
          onMouseEnter={() => { if (settingsTimeout.current) clearTimeout(settingsTimeout.current); setShowSettings(true); }}
          onMouseLeave={() => { settingsTimeout.current = setTimeout(() => setShowSettings(false), 300); }}
          ref={settingsRef}
        >
          <Link
            href="/dashboard/settings"
            className="flex items-center rounded-md p-1.5 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 dark:text-zinc-500 dark:hover:bg-zinc-800 dark:hover:text-zinc-300"
            title="Ajustes"
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
          {showSettings && (
            <div className="absolute bottom-full left-0 z-50 mb-1 w-52 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
              <div className="p-1">
                <SettingsLink href="/dashboard/settings" label="Todos los ajustes" currentPath={pathname} onClick={() => setShowSettings(false)} />
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                <SettingsLink href="/dashboard/settings/email" label="Mi cuenta de email" currentPath={pathname} onClick={() => setShowSettings(false)} />
                <SettingsLink href="/dashboard/whatsapp/settings" label="WhatsApp" currentPath={pathname} onClick={() => setShowSettings(false)} />
                <SettingsLink href="/dashboard/settings/notifications" label="Notificaciones" currentPath={pathname} onClick={() => setShowSettings(false)} />
                <div className="my-1 border-t border-zinc-100 dark:border-zinc-700" />
                <ThemeSelector />
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SettingsLink({ href, label, currentPath, onClick }: { href: string; label: string; currentPath: string | null; onClick: () => void }) {
  const isActive = currentPath?.startsWith(href);
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex w-full items-center rounded-md px-2 py-1.5 text-xs ${
        isActive
          ? "bg-zinc-100 font-medium text-zinc-900 dark:bg-zinc-700 dark:text-white"
          : "text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-700"
      }`}
    >
      {label}
    </Link>
  );
}

function ThemeSelector() {
  const [theme, setTheme] = useState<string>(() => {
    if (typeof window !== "undefined") return localStorage.getItem("theme") || "system";
    return "system";
  });

  const apply = (value: string) => {
    setTheme(value);
    localStorage.setItem("theme", value);
    if (value === "dark" || (value === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches)) {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  };

  const options = [
    { value: "light", label: "Claro" },
    { value: "dark", label: "Oscuro" },
    { value: "system", label: "Sistema" },
  ];

  return (
    <div className="flex items-center gap-1 px-2 py-1">
      <span className="text-[10px] font-medium text-zinc-400">Tema</span>
      <div className="ml-auto flex rounded-md border border-zinc-200 dark:border-zinc-600">
        {options.map((opt) => (
          <button
            key={opt.value}
            type="button"
            onClick={() => apply(opt.value)}
            className={`px-2 py-0.5 text-[10px] ${
              theme === opt.value
                ? "bg-zinc-200 font-medium text-zinc-900 dark:bg-zinc-600 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
            } ${opt.value === "light" ? "rounded-l-[3px]" : ""} ${opt.value === "system" ? "rounded-r-[3px]" : ""}`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  );
}
