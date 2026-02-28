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

/** Fixed base prices per unit by project type (fallback when no historical data) */
export const BASE_PRICES: Record<string, number> = {
  "Trofeos": 25,
  "Maquetas": 150,
  "Prototipos": 80,
  "Figuras": 35,
  "Piezas industriales": 60,
  "Merchandising": 15,
  "Arquitectura": 200,
  "Educacion": 20,
  "Otro": 40,
};

export const DEFAULT_BASE_PRICE = 40;
