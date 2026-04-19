import { requireRole } from "@/lib/rbac";
import Link from "next/link";

const SETTINGS = [
  {
    href: "/dashboard/settings/email",
    title: "Mi cuenta de email",
    description: "Conecta tu cuenta de Google para enviar emails desde el CRM",
    icon: "M16 12a4 4 0 10-8 0 4 4 0 008 0zm0 0v1.5a2.5 2.5 0 005 0V12a9 9 0 10-9 9m4.5-1.206a8.959 8.959 0 01-4.5 1.207",
  },
  {
    href: "/dashboard/whatsapp/settings",
    title: "WhatsApp",
    description: "Configura la instancia de WhatsApp Business",
    icon: "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z",
  },
  {
    href: "/dashboard/settings/notifications",
    title: "Notificaciones",
    description: "Configura notificaciones push y alertas",
    icon: "M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9",
  },
  {
    href: "/dashboard/settings/templates",
    title: "Plantillas de proyecto",
    description: "Gestiona las plantillas y checklists de produccion",
    icon: "M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4",
  },
];

export default async function SettingsPage() {
  await requireRole("manager");

  return (
    <div className="mx-auto max-w-2xl">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Ajustes
      </h1>

      <div className="space-y-2">
        {SETTINGS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 transition-colors hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800/70"
          >
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-100 dark:bg-zinc-800">
              <svg className="h-5 w-5 text-zinc-600 dark:text-zinc-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={s.icon} />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-zinc-900 dark:text-white">{s.title}</p>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">{s.description}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
