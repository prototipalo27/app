export interface TaxDeadline {
  model: string;
  period: string;
  dueDate: string;
  name: string;
}

const TAX_MODEL_NAMES: Record<string, string> = {
  "303": "IVA trimestral",
  "130": "IRPF trimestral",
  "200": "Impuesto de Sociedades",
};

export function getTaxDeadlines(year: number): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  // Modelo 303 — IVA trimestral
  deadlines.push(
    { model: "303", period: `${year}-Q1`, dueDate: `${year}-04-20`, name: "IVA Q1" },
    { model: "303", period: `${year}-Q2`, dueDate: `${year}-07-20`, name: "IVA Q2" },
    { model: "303", period: `${year}-Q3`, dueDate: `${year}-10-20`, name: "IVA Q3" },
    { model: "303", period: `${year}-Q4`, dueDate: `${year + 1}-01-30`, name: "IVA Q4" },
  );

  // Modelo 130 — IRPF trimestral
  deadlines.push(
    { model: "130", period: `${year}-Q1`, dueDate: `${year}-04-20`, name: "IRPF Q1" },
    { model: "130", period: `${year}-Q2`, dueDate: `${year}-07-20`, name: "IRPF Q2" },
    { model: "130", period: `${year}-Q3`, dueDate: `${year}-10-20`, name: "IRPF Q3" },
    { model: "130", period: `${year}-Q4`, dueDate: `${year + 1}-01-30`, name: "IRPF Q4" },
  );

  // Modelo 200 — Impuesto de Sociedades (anual)
  deadlines.push(
    { model: "200", period: `${year}`, dueDate: `${year}-07-25`, name: "IS Anual" },
  );

  return deadlines;
}

export function getModelName(model: string): string {
  return TAX_MODEL_NAMES[model] ?? `Modelo ${model}`;
}

export function getNextTaxDeadline(
  taxPayments: { model: string; period: string; due_date: string; status: string }[]
): { model: string; period: string; dueDate: string; daysLeft: number; name: string } | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const pending = taxPayments
    .filter((tp) => tp.status === "pending")
    .map((tp) => ({
      model: tp.model,
      period: tp.period,
      dueDate: tp.due_date,
      daysLeft: Math.ceil((new Date(tp.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
      name: `${getModelName(tp.model)} (${tp.period})`,
    }))
    .sort((a, b) => a.daysLeft - b.daysLeft);

  return pending[0] ?? null;
}
