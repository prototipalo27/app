import { NextResponse } from "next/server";
import * as XLSX from "xlsx";

export function GET() {
  const rows = [
    ["Línea 1 (premio o título)", "Línea 2 (persona) — opcional"],
    ["Premio MVP 2026", "Ana García"],
    ["Mejor Rookie", "Luis Pérez"],
    ["Empleado del año", ""],
  ];

  const sheet = XLSX.utils.aoa_to_sheet(rows);
  // Anchos de columna razonables para que se vea bien al abrirlo
  sheet["!cols"] = [{ wch: 32 }, { wch: 28 }];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, sheet, "Nombres");

  const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" }) as Buffer;

  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition":
        'attachment; filename="plantilla-nombres-prototipalo.xlsx"',
      "Cache-Control": "public, max-age=86400",
    },
  });
}
