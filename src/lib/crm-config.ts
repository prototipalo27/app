export type LeadStatus = "new" | "contacted" | "quoted" | "won" | "lost";

export type ActivityType = "note" | "email_sent" | "email_received" | "status_change" | "call";

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
  email_received:
    "bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-400",
  status_change:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  call: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
};

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  note: "Nota",
  email_sent: "Email enviado",
  email_received: "Email recibido",
  status_change: "Cambio de estado",
  call: "Llamada",
};

// ── Qualification Levels ─────────────────────────────────

export type QualificationLevel = 1 | 2 | 3 | 4 | 5;

export const QUALIFICATION_LEVELS: {
  level: QualificationLevel;
  label: string;
  color: string;
  badge: string;
}[] = [
  {
    level: 1,
    label: "Frío",
    color: "bg-zinc-400",
    badge: "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400",
  },
  {
    level: 2,
    label: "Tibio",
    color: "bg-blue-400",
    badge: "bg-blue-100 text-blue-600 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    level: 3,
    label: "Cualificado",
    color: "bg-amber-400",
    badge: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  },
  {
    level: 4,
    label: "Caliente",
    color: "bg-orange-500",
    badge: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    level: 5,
    label: "Prioritario",
    color: "bg-red-500",
    badge: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  },
];

export const QUALIFICATION_LABELS: Record<QualificationLevel, string> = {
  1: "Frío",
  2: "Tibio",
  3: "Cualificado",
  4: "Caliente",
  5: "Prioritario",
};

// ── Estimation ───────────────────────────────────────────

export type EstimatedQuantity = "1-10" | "10-50" | "50-200" | "200-500" | "500+";
export type EstimatedComplexity = "low" | "medium" | "high";
export type EstimatedUrgency = "normal" | "urgent";

export const QUANTITY_RANGES: { value: EstimatedQuantity; label: string; midpoint: number }[] = [
  { value: "1-10", label: "1 – 10 uds", midpoint: 5 },
  { value: "10-50", label: "10 – 50 uds", midpoint: 30 },
  { value: "50-200", label: "50 – 200 uds", midpoint: 125 },
  { value: "200-500", label: "200 – 500 uds", midpoint: 350 },
  { value: "500+", label: "500+ uds", midpoint: 750 },
];

export const COMPLEXITY_OPTIONS: { value: EstimatedComplexity; label: string; factor: number }[] = [
  { value: "low", label: "Baja", factor: 0.8 },
  { value: "medium", label: "Media", factor: 1.0 },
  { value: "high", label: "Alta", factor: 1.5 },
];

export const URGENCY_OPTIONS: { value: EstimatedUrgency; label: string; factor: number }[] = [
  { value: "normal", label: "Normal", factor: 1.0 },
  { value: "urgent", label: "Urgente", factor: 1.25 },
];

