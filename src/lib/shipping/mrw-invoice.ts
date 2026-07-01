import Anthropic from "@anthropic-ai/sdk";

// Parseo del resumen mensual de MRW (factura PDF) para imputar el coste de cada
// envío al proyecto correspondiente. La factura lista un albarán por envío con
// su importe, más recargos globales (Plus Combustible + Seguro Todo Riesgo) que
// se prorratean sobre cada envío para reflejar el coste real.

const client = new Anthropic();

// Sonnet para extracción estructurada de muchas líneas: prima la fidelidad
// (no fallar ni un albarán ni un importe) sobre la latencia. Es mensual.
const MODEL = "claude-sonnet-4-6";

export interface MrwInvoiceLine {
  /** Número de albarán MRW, p. ej. "02649F134426". Clave de casado. */
  albaran: string;
  /** Fecha del albarán en YYYY-MM-DD. */
  date: string | null;
  /** Tipo de servicio, p. ej. "U14E Nacional". */
  service: string | null;
  /** 'delivery' = entrega a cliente (Dest.); 'pickup' = recogida (Rem.). */
  kind: "delivery" | "pickup";
  /** Nombre del destinatario (o remitente si es recogida). */
  party_name: string | null;
  city: string | null;
  postal_code: string | null;
  packages: number | null;
  kg: number | null;
  /** Importe base de la línea en €, sin recargos. */
  amount: number;
}

export interface MrwInvoiceSurcharge {
  concept: string;
  amount: number;
}

export interface ParsedMrwInvoice {
  invoice_number: string | null;
  invoice_date: string | null;
  cost_center: string | null;
  lines: MrwInvoiceLine[];
  surcharges: MrwInvoiceSurcharge[];
  /** Base imponible total (líneas + recargos), sin IVA. */
  gross_amount: number | null;
  tax_amount: number | null;
  total_amount: number | null;
}

export interface MrwInvoiceTotals {
  linesAmount: number;
  surchargeAmount: number;
  grossAmount: number;
  /** Factor por el que se multiplica cada línea para repartir los recargos. */
  prorationFactor: number;
}

const PROMPT = `Esta es una factura mensual de MRW (mensajería). Extrae TODOS los envíos y datos en JSON.

Cada envío aparece como una línea "* Albarán <CODIGO> del <DD/MM/YYYY> <servicio> ... <bultos> <kilos> <importe>€" seguida de una línea "Dest.: NOMBRE / CIUDAD / CP / DIRECCION" (destinatario) o "Rem.: NOMBRE / ..." (remitente = es una RECOGIDA).

Devuelve SOLO este JSON, sin texto alrededor:
{
  "invoice_number": "FV-035741",
  "invoice_date": "2026-06-30",
  "cost_center": "050645",
  "lines": [
    {
      "albaran": "02649F134426",
      "date": "2026-06-02",
      "service": "U14E Nacional",
      "kind": "delivery",
      "party_name": "CONST. HNOS. GARBAYO CHIVITE, S.L.",
      "city": "CINTRUENIGO",
      "postal_code": "31592",
      "packages": 1,
      "kg": 3,
      "amount": 9.35
    }
  ],
  "surcharges": [
    { "concept": "Plus Combustible 9.3%", "amount": 13.13 },
    { "concept": "SEGURO TODORIESGO 6%", "amount": 14.92 }
  ],
  "gross_amount": 263.65,
  "tax_amount": 55.37,
  "total_amount": 319.02
}

Reglas:
- "kind" es "pickup" SOLO si la línea usa "Rem.:" (remitente); si usa "Dest.:" es "delivery".
- Importes con punto decimal (9.35, no 9,35).
- No inventes envíos: extrae exactamente los que aparecen (suele haber ~20-30).
- Los recargos (Plus Combustible, SEGURO TODORIESGO) van en "surcharges", NUNCA en "lines".
- Si algún dato no aparece, pon null. Responde solo el JSON.`;

function stripFences(raw: string): string {
  return raw
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim();
}

function toNum(v: unknown): number | null {
  if (typeof v === "number" && Number.isFinite(v)) return v;
  if (typeof v === "string") {
    const n = parseFloat(v.replace(",", "."));
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function toStr(v: unknown): string | null {
  return typeof v === "string" && v.trim() ? v.trim() : null;
}

export async function parseMrwInvoicePdf(
  pdfBuffer: Buffer,
): Promise<ParsedMrwInvoice> {
  const response = await client.messages.create({
    model: MODEL,
    max_tokens: 8000,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: pdfBuffer.toString("base64"),
            },
          },
          { type: "text", text: PROMPT },
        ],
      },
    ],
  });

  const rawText =
    response.content[0]?.type === "text" ? response.content[0].text : "";
  const parsed = JSON.parse(stripFences(rawText)) as Record<string, unknown>;

  const rawLines = Array.isArray(parsed.lines) ? parsed.lines : [];
  const lines: MrwInvoiceLine[] = rawLines
    .map((l): MrwInvoiceLine | null => {
      const rec = l as Record<string, unknown>;
      const albaran = toStr(rec.albaran);
      const amount = toNum(rec.amount);
      if (!albaran || amount === null) return null;
      return {
        albaran,
        date: toStr(rec.date),
        service: toStr(rec.service),
        kind: rec.kind === "pickup" ? "pickup" : "delivery",
        party_name: toStr(rec.party_name),
        city: toStr(rec.city),
        postal_code: toStr(rec.postal_code),
        packages: toNum(rec.packages),
        kg: toNum(rec.kg),
        amount,
      };
    })
    .filter((l): l is MrwInvoiceLine => l !== null);

  const rawSur = Array.isArray(parsed.surcharges) ? parsed.surcharges : [];
  const surcharges: MrwInvoiceSurcharge[] = rawSur
    .map((s): MrwInvoiceSurcharge | null => {
      const rec = s as Record<string, unknown>;
      const concept = toStr(rec.concept);
      const amount = toNum(rec.amount);
      if (!concept || amount === null) return null;
      return { concept, amount };
    })
    .filter((s): s is MrwInvoiceSurcharge => s !== null);

  return {
    invoice_number: toStr(parsed.invoice_number),
    invoice_date: toStr(parsed.invoice_date),
    cost_center: toStr(parsed.cost_center),
    lines,
    surcharges,
    gross_amount: toNum(parsed.gross_amount),
    tax_amount: toNum(parsed.tax_amount),
    total_amount: toNum(parsed.total_amount),
  };
}

/**
 * Calcula los totales y el factor de prorrateo de recargos. Cada línea se
 * multiplica por (base_total / suma_lineas) para repartir combustible + seguro.
 */
export function computeInvoiceTotals(inv: ParsedMrwInvoice): MrwInvoiceTotals {
  const round2 = (n: number) => Math.round(n * 100) / 100;
  const linesAmount = round2(inv.lines.reduce((s, l) => s + l.amount, 0));
  const surchargeAmount = round2(inv.surcharges.reduce((s, x) => s + x.amount, 0));
  // Preferimos la base imponible declarada; si no viene, líneas + recargos.
  const grossAmount = round2(inv.gross_amount ?? linesAmount + surchargeAmount);
  const prorationFactor = linesAmount > 0 ? grossAmount / linesAmount : 1;
  return { linesAmount, surchargeAmount, grossAmount, prorationFactor };
}

/** Coste imputado a una línea (importe base + su parte de recargos). */
export function proratedLineCost(
  amount: number,
  factor: number,
): number {
  return Math.round(amount * factor * 100) / 100;
}
