import * as XLSX from "xlsx";

export type ParsedEntry = {
  line1: string;
  line2?: string;
  checked: boolean;
};

const HEADER_HINTS = ["linea 1", "línea 1", "premio", "titulo", "título", "trofeo"];

function isHeaderRow(line1: string | undefined): boolean {
  if (!line1) return false;
  const norm = line1.trim().toLowerCase();
  return HEADER_HINTS.some((h) => norm.startsWith(h));
}

function rowsToEntries(rows: string[][]): ParsedEntry[] {
  const entries: ParsedEntry[] = [];
  rows.forEach((row, idx) => {
    const a = (row[0] ?? "").toString().trim();
    const b = (row[1] ?? "").toString().trim();
    if (!a) return;
    if (idx === 0 && isHeaderRow(a)) return;
    entries.push({
      line1: a,
      line2: b || undefined,
      checked: false,
    });
  });
  return entries;
}

function parseCsvText(text: string): ParsedEntry[] {
  const rows = text
    .split(/\r?\n/)
    .map((line) => {
      const trimmed = line.trim();
      if (!trimmed) return [] as string[];
      // Soporta coma, punto y coma o tab. No maneja comas dentro de comillas
      // (suficiente para nombres normales; xlsx para casos complejos).
      const sep = trimmed.includes(";") ? ";" : trimmed.includes("\t") ? "\t" : ",";
      return trimmed.split(sep).map((c) => c.replace(/^"|"$/g, "").trim());
    })
    .filter((r) => r.length > 0 && r.some((c) => c));
  return rowsToEntries(rows);
}

async function parseXlsxFile(file: File): Promise<ParsedEntry[]> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows: string[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    blankrows: false,
  });
  return rowsToEntries(rows.map((r) => r.map((c) => String(c ?? ""))));
}

export async function parseNameListFile(file: File): Promise<ParsedEntry[]> {
  const ext = (file.name.split(".").pop() || "").toLowerCase();
  if (ext === "xlsx" || ext === "xls") {
    return parseXlsxFile(file);
  }
  const text = await file.text();
  return parseCsvText(text);
}
