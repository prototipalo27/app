import Link from "next/link";
import { requireRole } from "@/lib/rbac";

const SECTIONS: { href: string; label: string; description: string }[] = [
  {
    href: "/dashboard/settings/email",
    label: "Mi cuenta de email",
    description: "Conecta tu cuenta de Google para enviar emails desde el CRM.",
  },
  {
    href: "/dashboard/settings/notifications",
    label: "Notificaciones",
    description: "Configura qué eventos recibes por push o email.",
  },
  {
    href: "/dashboard/settings/email-snippets",
    label: "Plantillas de email",
    description: "Respuestas rápidas reutilizables para el CRM.",
  },
  {
    href: "/dashboard/settings/templates",
    label: "Plantillas de proyecto",
    description: "Plantillas para acelerar la creación de proyectos.",
  },
  {
    href: "/dashboard/settings/printers",
    label: "Impresoras",
    description: "Configuración y credenciales de impresoras.",
  },
];

export default async function SettingsHubPage() {
  await requireRole("comercial");

  return (
    <div className="mx-auto max-w-3xl p-4 md:p-8">
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">Ajustes</h1>
      <div className="space-y-2">
        {SECTIONS.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="block rounded-xl border border-zinc-200 bg-white p-4 transition hover:border-zinc-300 hover:bg-zinc-50 dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-zinc-700 dark:hover:bg-zinc-800/50"
          >
            <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{s.label}</h2>
            <p className="mt-0.5 text-xs text-zinc-500 dark:text-zinc-400">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
