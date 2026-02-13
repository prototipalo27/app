export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export type ActivityType = "note" | "email_sent" | "status_change" | "call";

export const LEAD_COLUMNS: {
  id: LeadStatus;
  label: string;
  accent: string;
  badge: string;
}[] = [
  {
    id: "new",
    label: "Nuevos",
    accent: "bg-zinc-400",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  {
    id: "contacted",
    label: "Contactados",
    accent: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    id: "quoted",
    label: "Presupuestados",
    accent: "bg-amber-500",
    badge:
      "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    id: "won",
    label: "Ganados",
    accent: "bg-green-500",
    badge:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
  {
    id: "lost",
    label: "Perdidos",
    accent: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
];

export const STATUS_LABELS: Record<LeadStatus, string> = {
  new: "Nuevo",
  contacted: "Contactado",
  quoted: "Presupuestado",
  won: "Ganado",
  lost: "Perdido",
};

export const ACTIVITY_COLORS: Record<ActivityType, string> = {
  note: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  email_sent:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  status_change:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  call: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Nota",
  email_sent: "Email enviado",
  status_change: "Cambio de estado",
  call: "Llamada",
};
