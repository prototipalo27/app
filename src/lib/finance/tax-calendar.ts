export interface TaxDeadline {
  model: string;
  period: string;
  dueDate: string;
  name: string;
}

const TAX_MODEL_NAMES: Record<string, string> = {
  "303": "IVA trimestral",
  "200": "Impuesto de Sociedades",
  "111": "Retenciones IRPF trimestral",
  "115": "Retenciones alquileres trimestral",
};

// Modelos que NO admiten aplazamiento/fraccionamiento en AEAT.
// Retenciones (111, 115) se consideran deuda de un tercero, no son aplazables.
const NON_DEFERRABLE_MODELS: Set<string> = new Set(["111", "115"]);

export function isTaxDeferrable(model: string): boolean {
  return !NON_DEFERRABLE_MODELS.has(model);
}

export function getTaxDeadlines(year: number): TaxDeadline[] {
  const deadlines: TaxDeadline[] = [];

  // Modelo 303 — IVA trimestral
  deadlines.push(
    { model: "303", period: `${year}-Q1`, dueDate: `${year}-04-20`, name: "IVA Q1" },
    { model: "303", period: `${year}-Q2`, dueDate: `${year}-07-20`, name: "IVA Q2" },
    { model: "303", period: `${year}-Q3`, dueDate: `${year}-10-20`, name: "IVA Q3" },
    { model: "303", period: `${year}-Q4`, dueDate: `${year + 1}-01-30`, name: "IVA Q4" },
  );

  // Modelo 111 — Retenciones IRPF trimestral (nominas)
  deadlines.push(
    { model: "111", period: `${year}-Q1`, dueDate: `${year}-04-20`, name: "Ret. IRPF Q1" },
    { model: "111", period: `${year}-Q2`, dueDate: `${year}-07-20`, name: "Ret. IRPF Q2" },
    { model: "111", period: `${year}-Q3`, dueDate: `${year}-10-20`, name: "Ret. IRPF Q3" },
    { model: "111", period: `${year}-Q4`, dueDate: `${year + 1}-01-30`, name: "Ret. IRPF Q4" },
  );

  // Modelo 115 — Retenciones alquileres trimestral
  deadlines.push(
    { model: "115", period: `${year}-Q1`, dueDate: `${year}-04-20`, name: "Ret. Alq. Q1" },
    { model: "115", period: `${year}-Q2`, dueDate: `${year}-07-20`, name: "Ret. Alq. Q2" },
    { model: "115", period: `${year}-Q3`, dueDate: `${year}-10-20`, name: "Ret. Alq. Q3" },
    { model: "115", period: `${year}-Q4`, dueDate: `${year + 1}-01-30`, name: "Ret. Alq. Q4" },
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
  taxPayments: {
    model: string;
    period: string;
    due_date: string;
    status: string;
    situacion?: string;
    installments?: { fecha_vencimiento: string; pagado: boolean; numero_plazo: number }[] | null;
  }[]
): { model: string; period: string; dueDate: string; daysLeft: number; name: string } | null {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const candidates: { model: string; period: string; dueDate: string; daysLeft: number; name: string }[] = [];

  for (const tp of taxPayments) {
    if (tp.status === "paid" || tp.situacion === "pagado") continue;

    const hasInstallments =
      (tp.situacion === "aplazada" || tp.situacion === "fraccionada") &&
      (tp.installments?.length ?? 0) > 0;

    if (hasInstallments) {
      // Nearest unpaid installment
      const nextInst = (tp.installments ?? [])
        .filter((i) => !i.pagado)
        .sort((a, b) => a.fecha_vencimiento.localeCompare(b.fecha_vencimiento))[0];
      if (!nextInst) continue;
      candidates.push({
        model: tp.model,
        period: tp.period,
        dueDate: nextInst.fecha_vencimiento,
        daysLeft: Math.ceil((new Date(nextInst.fecha_vencimiento).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        name: `${getModelName(tp.model)} (${tp.period}) — Plazo ${nextInst.numero_plazo}`,
      });
    } else {
      candidates.push({
        model: tp.model,
        period: tp.period,
        dueDate: tp.due_date,
        daysLeft: Math.ceil((new Date(tp.due_date).getTime() - now.getTime()) / (1000 * 60 * 60 * 24)),
        name: `${getModelName(tp.model)} (${tp.period})`,
      });
    }
  }

  candidates.sort((a, b) => a.daysLeft - b.daysLeft);
  return candidates[0] ?? null;
}
