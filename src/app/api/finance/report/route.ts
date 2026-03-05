import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
// eslint-disable-next-line @typescript-eslint/no-require-imports
const PdfPrinter = require("pdfmake");
import type { TDocumentDefinitions, Content, TableCell } from "pdfmake/interfaces";

const fonts = {
  Helvetica: {
    normal: "Helvetica",
    bold: "Helvetica-Bold",
    italics: "Helvetica-Oblique",
    bolditalics: "Helvetica-BoldOblique",
  },
};

function formatEur(n: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(n);
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "—";
  return new Date(dateStr).toLocaleDateString("es-ES");
}

const CATEGORY_LABELS: Record<string, string> = {
  payroll: "Nominas",
  rent: "Alquiler",
  utilities: "Suministros",
  insurance: "Seguros",
  software: "Software/SaaS",
  telecom: "Telecomunicaciones",
  taxes: "Impuestos",
  materials: "Material",
  travel: "Viajes",
  meals: "Comidas",
  fuel: "Gasolinas",
  shipping: "Envios",
  banking: "Bancos",
  financing: "Financiaciones",
  marketing: "Marketing",
  professional: "Serv. profesionales",
  income: "Ingresos",
  other: "Otros",
};

const MONTH_NAMES = [
  "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

function tableHeader(cells: string[]): TableCell[] {
  return cells.map((text) => ({
    text,
    bold: true,
    fontSize: 9,
    fillColor: "#f4f4f5",
    color: "#3f3f46",
    margin: [4, 6, 4, 6] as [number, number, number, number],
  }));
}

function tableRow(cells: (string | number)[], isEven: boolean): TableCell[] {
  return cells.map((text) => ({
    text: String(text),
    fontSize: 9,
    margin: [4, 4, 4, 4] as [number, number, number, number],
    fillColor: isEven ? "#fafafa" : undefined,
  }));
}

export async function GET(request: NextRequest) {
  try {
    await requireRole("manager");
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1));
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()));

  if (month < 1 || month > 12 || year < 2020) {
    return NextResponse.json({ error: "Invalid month/year" }, { status: 400 });
  }

  const supabase = await createClient();
  const monthKey = `${year}-${String(month).padStart(2, "0")}`;
  const monthStart = `${monthKey}-01`;
  const nextMonth = month === 12 ? `${year + 1}-01-01` : `${year}-${String(month + 1).padStart(2, "0")}-01`;

  // Fetch all data in parallel
  const [
    { data: fixedExpenses },
    { data: financings },
    { data: bankStatements },
    { data: vendorMappings },
    { data: purchaseItems },
    { data: shippingInfo },
    { data: taxPayments },
    { data: projects },
  ] = await Promise.all([
    supabase.from("fixed_expenses").select("*").eq("is_active", true).order("category").order("name"),
    supabase.from("financings").select("*").eq("is_active", true).order("end_date"),
    supabase.from("bank_statements").select("month, year, transactions").eq("month", month).eq("year", year),
    supabase.from("vendor_mappings").select("bank_vendor_name, category"),
    supabase.from("purchase_items").select("id, description, status, actual_price, estimated_price, created_at").gte("created_at", monthStart).lt("created_at", nextMonth),
    supabase.from("shipping_info").select("id, price, created_at, carrier, recipient_name").gte("created_at", monthStart).lt("created_at", nextMonth),
    supabase.from("tax_payments").select("*").like("period", `${year}%`),
    supabase.from("projects").select("id, name, price, invoice_date, status, project_type").gte("invoice_date", monthStart).lt("invoice_date", nextMonth),
  ]);

  // ── Compute bank expenses by category ──
  const vendorCategoryMap = new Map<string, string>();
  for (const vm of vendorMappings ?? []) {
    if (vm.category) vendorCategoryMap.set(vm.bank_vendor_name.toLowerCase(), vm.category);
  }

  type BankTx = { vendorName?: string; amount: number; description?: string };
  const bankStmt = (bankStatements ?? [])[0];
  const bankTxs: BankTx[] = bankStmt ? (bankStmt.transactions as unknown as BankTx[]) || [] : [];

  const bankByCategory: Record<string, number> = {};
  let bankUncategorized = 0;
  let bankTotalExpenses = 0;
  let bankTotalIncome = 0;

  for (const t of bankTxs) {
    if (t.amount >= 0) {
      bankTotalIncome += t.amount;
      continue;
    }
    const absAmount = Math.abs(t.amount);
    bankTotalExpenses += absAmount;
    const cat = t.vendorName ? vendorCategoryMap.get(t.vendorName.toLowerCase()) : undefined;
    if (cat) {
      bankByCategory[cat] = (bankByCategory[cat] || 0) + absAmount;
    } else {
      bankUncategorized += absAmount;
    }
  }

  // ── Compute totals ──
  const allProjects = projects ?? [];
  const confirmedProjects = allProjects.filter((p) => p.project_type === "confirmed");
  const totalInvoiced = confirmedProjects.reduce((s, p) => s + (p.price ?? 0), 0);

  const allFixed = fixedExpenses ?? [];
  const monthlyFixedTotal = allFixed.reduce((sum, e) => {
    if (e.frequency === "monthly") return sum + e.amount;
    if (e.frequency === "quarterly") return sum + e.amount / 3;
    if (e.frequency === "annual") return sum + e.amount / 12;
    return sum + e.amount;
  }, 0);

  const allPurchases = (purchaseItems ?? []).filter((p) => p.status === "received");
  const purchasesTotal = allPurchases.reduce((s, p) => s + (p.actual_price ?? p.estimated_price ?? 0), 0);

  const allShipments = shippingInfo ?? [];
  const shipmentsTotal = allShipments.reduce((s, sh) => s + (sh.price ?? 0), 0);

  const activeFinancings = (financings ?? []).filter((f) => f.paid_installments < f.total_installments);
  const financingsTotal = activeFinancings.reduce((s, f) => s + f.monthly_payment, 0);

  const totalExpenses = bankTotalExpenses > 0
    ? bankTotalExpenses
    : monthlyFixedTotal + purchasesTotal + shipmentsTotal + financingsTotal;
  const balance = totalInvoiced - totalExpenses;

  // ── Relevant tax payments for this period ──
  const relevantTaxes = (taxPayments ?? []).filter((tp) => {
    const dueDate = new Date(tp.due_date);
    return dueDate.getMonth() + 1 === month && dueDate.getFullYear() === year;
  });

  // ── Build PDF ──
  const monthName = MONTH_NAMES[month - 1];
  const content: Content[] = [];

  // Header
  content.push({
    text: `Prototipalo — Reporte de gastos`,
    fontSize: 18,
    bold: true,
    color: "#18181b",
    margin: [0, 0, 0, 4],
  });
  content.push({
    text: `${monthName} ${year}`,
    fontSize: 14,
    color: "#71717a",
    margin: [0, 0, 0, 20],
  });

  // Executive summary
  content.push({
    text: "Resumen ejecutivo",
    fontSize: 13,
    bold: true,
    color: "#18181b",
    margin: [0, 0, 0, 8],
  });

  content.push({
    table: {
      widths: ["*", "*", "*"],
      body: [
        tableHeader(["Total facturado", "Total gastos", "Balance neto"]),
        [
          { text: formatEur(totalInvoiced), fontSize: 11, bold: true, color: "#18181b", margin: [4, 6, 4, 6] as [number, number, number, number] },
          { text: formatEur(totalExpenses), fontSize: 11, bold: true, color: "#dc2626", margin: [4, 6, 4, 6] as [number, number, number, number] },
          { text: formatEur(balance), fontSize: 11, bold: true, color: balance >= 0 ? "#16a34a" : "#dc2626", margin: [4, 6, 4, 6] as [number, number, number, number] },
        ],
      ],
    },
    layout: "lightHorizontalLines",
    margin: [0, 0, 0, 20],
  });

  if (bankTotalExpenses > 0) {
    content.push({
      text: `Fuente de gastos: extracto bancario (${bankTxs.length} movimientos)`,
      fontSize: 8,
      color: "#a1a1aa",
      italics: true,
      margin: [0, -16, 0, 16],
    });
  }

  // Table 1 — Bank expenses by category
  if (bankTotalExpenses > 0) {
    content.push({
      text: "Gastos bancarios por categoria",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const catRows: TableCell[][] = [tableHeader(["Categoria", "Importe"])];
    const sortedCats = Object.entries(bankByCategory).sort((a, b) => b[1] - a[1]);
    sortedCats.forEach(([cat, amount], i) => {
      catRows.push(tableRow([CATEGORY_LABELS[cat] || cat, formatEur(amount)], i % 2 === 0));
    });
    if (bankUncategorized > 0) {
      catRows.push(tableRow(["Sin categorizar", formatEur(bankUncategorized)], sortedCats.length % 2 === 0));
    }
    catRows.push([
      { text: "Total", bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: formatEur(bankTotalExpenses), bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
    ]);

    content.push({
      table: { widths: ["*", 120], body: catRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });

    // Also show income if present
    if (bankTotalIncome > 0) {
      content.push({
        text: `Ingresos en extracto bancario: ${formatEur(bankTotalIncome)}`,
        fontSize: 9,
        color: "#16a34a",
        margin: [0, -16, 0, 16],
      });
    }
  }

  // Table 2 — Fixed expenses
  if (allFixed.length > 0) {
    content.push({
      text: "Gastos fijos",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const fixedRows: TableCell[][] = [tableHeader(["Nombre", "Categoria", "Importe mensual", "Notas"])];
    allFixed.forEach((exp, i) => {
      let monthlyAmount = exp.amount;
      if (exp.frequency === "quarterly") monthlyAmount = exp.amount / 3;
      if (exp.frequency === "annual") monthlyAmount = exp.amount / 12;

      const freqLabel = exp.frequency === "monthly" ? "" : ` (${exp.frequency})`;
      fixedRows.push(tableRow(
        [exp.name, CATEGORY_LABELS[exp.category] || exp.category, formatEur(monthlyAmount) + freqLabel, exp.notes || "—"],
        i % 2 === 0,
      ));
    });
    fixedRows.push([
      { text: "Total mensual", bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5", colSpan: 2 },
      {},
      { text: formatEur(monthlyFixedTotal), bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: "", fillColor: "#f4f4f5", margin: [4, 6, 4, 6] as [number, number, number, number] },
    ]);

    content.push({
      table: { widths: ["*", "auto", 100, "*"], body: fixedRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });
  }

  // Table 3 — Financings
  if (activeFinancings.length > 0) {
    content.push({
      text: "Financiaciones",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const finRows: TableCell[][] = [tableHeader(["Nombre", "Cuota mensual", "Cuotas pagadas/total", "Notas"])];
    activeFinancings.forEach((f, i) => {
      finRows.push(tableRow(
        [f.name, formatEur(f.monthly_payment), `${f.paid_installments}/${f.total_installments}`, f.notes || "—"],
        i % 2 === 0,
      ));
    });
    finRows.push([
      { text: "Total mensual", bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: formatEur(financingsTotal), bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: "", fillColor: "#f4f4f5", margin: [4, 6, 4, 6] as [number, number, number, number] },
      { text: "", fillColor: "#f4f4f5", margin: [4, 6, 4, 6] as [number, number, number, number] },
    ]);

    content.push({
      table: { widths: ["*", 100, "auto", "*"], body: finRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });
  }

  // Table 4 — Purchases
  if (allPurchases.length > 0) {
    content.push({
      text: "Compras de material",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const purchaseRows: TableCell[][] = [tableHeader(["Descripcion", "Importe", "Fecha"])];
    allPurchases.forEach((p, i) => {
      purchaseRows.push(tableRow(
        [p.description || "Sin descripcion", formatEur(p.actual_price ?? p.estimated_price ?? 0), formatDate(p.created_at)],
        i % 2 === 0,
      ));
    });
    purchaseRows.push([
      { text: "Total", bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: formatEur(purchasesTotal), bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: "", fillColor: "#f4f4f5", margin: [4, 6, 4, 6] as [number, number, number, number] },
    ]);

    content.push({
      table: { widths: ["*", 100, 80], body: purchaseRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });
  }

  // Table 5 — Shipments
  if (allShipments.length > 0) {
    content.push({
      text: "Envios",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const shipRows: TableCell[][] = [tableHeader(["Destinatario", "Carrier", "Precio", "Fecha"])];
    allShipments.forEach((s, i) => {
      shipRows.push(tableRow(
        [s.recipient_name || "—", s.carrier || "—", formatEur(s.price ?? 0), formatDate(s.created_at)],
        i % 2 === 0,
      ));
    });
    shipRows.push([
      { text: "Total", bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5", colSpan: 2 },
      {},
      { text: formatEur(shipmentsTotal), bold: true, fontSize: 9, margin: [4, 6, 4, 6] as [number, number, number, number], fillColor: "#f4f4f5" },
      { text: "", fillColor: "#f4f4f5", margin: [4, 6, 4, 6] as [number, number, number, number] },
    ]);

    content.push({
      table: { widths: ["*", "auto", 80, 80], body: shipRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });
  }

  // Table 6 — Tax payments
  if (relevantTaxes.length > 0) {
    content.push({
      text: "Impuestos del periodo",
      fontSize: 13,
      bold: true,
      color: "#18181b",
      margin: [0, 0, 0, 8],
    });

    const taxRows: TableCell[][] = [tableHeader(["Modelo", "Periodo", "Importe", "Estado"])];
    relevantTaxes.forEach((tp, i) => {
      const statusLabel = tp.status === "paid" ? "Pagado" : tp.status === "pending" ? "Pendiente" : tp.status;
      taxRows.push(tableRow(
        [tp.model, tp.period, tp.amount ? formatEur(tp.amount) : "—", statusLabel],
        i % 2 === 0,
      ));
    });

    content.push({
      table: { widths: ["auto", "auto", 100, "auto"], body: taxRows },
      layout: "lightHorizontalLines",
      margin: [0, 0, 0, 20],
    });
  }

  // Footer
  const generatedAt = new Date().toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" });
  content.push({
    text: `Generado el ${generatedAt} — Prototipalo`,
    fontSize: 8,
    color: "#a1a1aa",
    alignment: "center",
    margin: [0, 20, 0, 0],
  });

  const docDefinition: TDocumentDefinitions = {
    content,
    defaultStyle: { font: "Helvetica" },
    pageSize: "A4",
    pageMargins: [40, 40, 40, 40],
  };

  const printer = new PdfPrinter(fonts);
  const pdfDoc = printer.createPdfKitDocument(docDefinition);

  // Collect PDF chunks into a buffer
  const chunks: Buffer[] = [];
  return new Promise<Response>((resolve) => {
    pdfDoc.on("data", (chunk: Buffer) => chunks.push(chunk));
    pdfDoc.on("end", () => {
      const pdfBuffer = Buffer.concat(chunks);
      const filename = `Prototipalo_Gastos_${monthName}_${year}.pdf`;
      resolve(
        new Response(pdfBuffer, {
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `attachment; filename="${filename}"`,
          },
        })
      );
    });
    pdfDoc.end();
  });
}
