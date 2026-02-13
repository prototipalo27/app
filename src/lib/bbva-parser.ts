import * as XLSX from "xlsx";

export interface BankTransaction {
  date: string;
  valueDate: string;
  description: string;
  amount: number;
  balance: number;
  status: string;
  vendorName: string;
}

export interface VendorGroup {
  vendorName: string;
  transactions: BankTransaction[];
  totalAmount: number;
}

/**
 * Parse a BBVA bank statement Excel file (.xlsx).
 * Returns all transactions found in the sheet.
 */
export function parseBBVAStatement(data: ArrayBuffer): BankTransaction[] {
  const workbook = XLSX.read(data, { type: "array" });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];

  // Convert to array of arrays for flexible parsing
  const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  // Find the header row (look for "Fecha" or "F. Valor")
  let headerIdx = -1;
  for (let i = 0; i < Math.min(rows.length, 20); i++) {
    const row = rows[i];
    if (!row) continue;
    const joined = row.map((c) => String(c).toLowerCase()).join(" ");
    if (joined.includes("fecha") && (joined.includes("importe") || joined.includes("movimiento"))) {
      headerIdx = i;
      break;
    }
  }

  if (headerIdx === -1) {
    throw new Error("No se encontró la cabecera del extracto. Asegúrate de subir un extracto BBVA en formato .xlsx");
  }

  const headers = rows[headerIdx].map((h) => String(h).toLowerCase().trim());

  // Map column indices
  const dateCol = headers.findIndex((h) => h === "fecha" || h.startsWith("f."));
  const valueDateCol = headers.findIndex((h) => h.includes("valor") || h === "f. valor");
  const descCol = headers.findIndex((h) => h.includes("concepto") || h.includes("descripci") || h.includes("movimiento"));
  const amountCol = headers.findIndex((h) => h.includes("importe") || h.includes("cantidad"));
  const balanceCol = headers.findIndex((h) => h.includes("saldo") || h.includes("disponible"));
  const statusCol = headers.findIndex((h) => h.includes("estado") || h.includes("situaci"));

  if (dateCol === -1 || amountCol === -1) {
    throw new Error("No se encontraron las columnas de Fecha e Importe en el extracto");
  }

  const transactions: BankTransaction[] = [];

  for (let i = headerIdx + 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || row.every((c) => String(c).trim() === "")) continue;

    const dateStr = String(row[dateCol] ?? "").trim();
    if (!dateStr || dateStr.toLowerCase().includes("total")) continue;

    const rawAmount = String(row[amountCol] ?? "0");
    const amount = parseAmount(rawAmount);
    const description = String(row[descCol >= 0 ? descCol : 2] ?? "").trim();
    const status = statusCol >= 0 ? String(row[statusCol] ?? "").trim() : "";

    transactions.push({
      date: dateStr,
      valueDate: valueDateCol >= 0 ? String(row[valueDateCol] ?? "").trim() : dateStr,
      description,
      amount,
      balance: balanceCol >= 0 ? parseAmount(String(row[balanceCol] ?? "0")) : 0,
      status,
      vendorName: extractVendorName(description),
    });
  }

  return transactions;
}

/**
 * Parse a Spanish-format number: "1.234,56" → 1234.56
 */
function parseAmount(raw: string): number {
  const cleaned = raw
    .replace(/[€\s]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return parseFloat(cleaned) || 0;
}

/**
 * Extract a clean vendor name from a BBVA transaction description.
 *
 * Typical patterns:
 * - "1234****5678 AMAZON MARKETPLACE ES LUXEMBURGO LU PAGO CON TARJETA 01/01"
 * - "TRANSFERENCIA A: PROVEEDOR SL CONCEPTO: FACTURA 123"
 * - "ADEUDO DE PROVEEDOR SA REF: ..."
 */
export function extractVendorName(description: string): string {
  let name = description;

  // Remove card number prefix: "1234****5678 " or similar
  name = name.replace(/^[\d*]{8,}\s+/, "");

  // Early check on raw description: group all AMZN Mktp / Amazon variants
  // Catches "AMZN Mktp ES*Z748Q43G4", "AMZN Mktp ES*EU0QW73W5", etc.
  if (/amzn\s*mktp/i.test(name) || /amazon\s*market/i.test(name)) {
    return "Amazon Marketplace";
  }
  if (/amazon/i.test(name) || /amzn/i.test(name)) {
    if (/prime/i.test(name)) return "Amazon Prime";
    if (/web\s*services|aws/i.test(name)) return "Amazon Web Services";
    return "Amazon Marketplace";
  }

  // Remove trailing payment method phrases
  const suffixPatterns = [
    /\s+PAGO CON TARJETA.*$/i,
    /\s+COMPRA TARJETA.*$/i,
    /\s+PAGO EN.*$/i,
    /\s+TRANSFERENCIA(S)?(\s+A:?\s*)?/i,
    /\s+ADEUDO\s+DE\s*/i,
    /\s+ADEUDO\s+POR\s*/i,
    /\s+DOMICILIACION\s*/i,
    /\s+RECIBO\s*/i,
    /\s+CONCEPTO:.*$/i,
    /\s+REF[\s.:]+.*$/i,
    /\s+REFERENCIA[\s.:]+.*$/i,
    /\s+COMISION(ES)?.*$/i,
    /\s+N[ºO]\s*OPER.*$/i,
  ];

  for (const pattern of suffixPatterns) {
    name = name.replace(pattern, "");
  }

  // Remove city + country code at the end (e.g., "MADRID ES", "LUXEMBURGO LU")
  name = name.replace(/\s+[A-Z]{2,20}\s+[A-Z]{2}\s*$/, "");

  // Remove trailing date patterns (dd/mm, dd/mm/yy)
  name = name.replace(/\s+\d{2}\/\d{2}(\/\d{2,4})?\s*$/, "");

  // Normalize PayPal
  if (/paypal/i.test(name)) {
    // Try to extract the actual vendor after PayPal
    const paypalMatch = name.match(/paypal\s*\*?\s*(.+)/i);
    if (paypalMatch && paypalMatch[1].trim().length > 2) {
      return `PayPal - ${paypalMatch[1].trim()}`;
    }
    return "PayPal";
  }

  // Clean up extra whitespace
  name = name.replace(/\s+/g, " ").trim();

  // Title case if all uppercase
  if (name === name.toUpperCase() && name.length > 3) {
    name = name
      .split(" ")
      .map((w) => {
        if (w.length <= 3) return w;
        return w.charAt(0) + w.slice(1).toLowerCase();
      })
      .join(" ");
  }

  return name || description.substring(0, 40);
}

/**
 * Filter transactions to only "Pendiente" status (not yet reconciled).
 */
export function filterPending(transactions: BankTransaction[]): BankTransaction[] {
  return transactions.filter(
    (t) => t.status.toLowerCase().includes("pendiente") || t.status === ""
  );
}

/**
 * Group transactions by vendor name.
 */
export function groupByVendor(transactions: BankTransaction[]): VendorGroup[] {
  const map = new Map<string, BankTransaction[]>();

  for (const t of transactions) {
    const key = t.vendorName;
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(t);
  }

  return Array.from(map.entries())
    .map(([vendorName, txs]) => ({
      vendorName,
      transactions: txs.sort((a, b) => a.date.localeCompare(b.date)),
      totalAmount: txs.reduce((sum, t) => sum + t.amount, 0),
    }))
    .sort((a, b) => a.totalAmount - b.totalAmount); // Most negative (largest expense) first
}
