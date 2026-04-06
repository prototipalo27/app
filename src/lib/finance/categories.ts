/**
 * Central expense category definitions.
 * Single source of truth — all UI and server code should import from here.
 */

export const EXPENSE_CATEGORIES: { value: string; label: string }[] = [
  { value: "production", label: "Producción" },
  { value: "payroll", label: "Nóminas" },
  { value: "facilities", label: "Local y suministros" },
  { value: "software", label: "Software/SaaS" },
  { value: "finance", label: "Banca y financiación" },
  { value: "taxes", label: "Impuestos" },
  { value: "operations", label: "Operaciones" },
  { value: "marketing", label: "Marketing" },
  { value: "income", label: "Ingresos" },
  { value: "other", label: "Otros" },
];

export const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  EXPENSE_CATEGORIES.map((c) => [c.value, c.label])
);

export const CATEGORY_COLORS: Record<string, string> = {
  production: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400",
  payroll: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  facilities: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  software: "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400",
  finance: "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-400",
  taxes: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  operations: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400",
  marketing: "bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-400",
  income: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  other: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

/** Solid hex colors for charts (bar, pie, etc.) */
export const CATEGORY_CHART_COLORS: Record<string, string> = {
  production: "#f59e0b",
  payroll: "#3b82f6",
  facilities: "#a855f7",
  software: "#8b5cf6",
  finance: "#f43f5e",
  taxes: "#ef4444",
  operations: "#10b981",
  marketing: "#ec4899",
  income: "#22c55e",
  other: "#71717a",
};

// ── Migration from old 18-category system ──

const MIGRATION_MAP: Record<string, string> = {
  materials: "production",
  shipping: "production",
  payroll: "payroll",
  rent: "facilities",
  utilities: "facilities",
  telecom: "facilities",
  software: "software",
  banking: "finance",
  financing: "finance",
  insurance: "finance",
  taxes: "taxes",
  fuel: "operations",
  meals: "operations",
  travel: "operations",
  professional: "operations",
  marketing: "marketing",
  income: "income",
  other: "other",
};

/** Map a legacy category key to the new consolidated key. Returns as-is if already new. */
export function migrateCategory(category: string): string {
  return MIGRATION_MAP[category] ?? category;
}
