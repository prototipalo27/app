// Punto de entrada: DXF (texto) + parámetros → STL de la carcasa.

import { extractContours, type Pt } from "./contours";
import { buildCarcasa, type CarcasaParams, type BuildResult } from "./mesh";

export type { CarcasaParams, BuildResult };

export type DxfUnit = "auto" | "mm" | "cm" | "m" | "in";

// mm por unidad del DXF según código $INSUNITS.
const INSUNITS_TO_MM: Record<number, number> = {
  1: 25.4, // pulgadas
  2: 304.8, // pies
  4: 1, // mm
  5: 10, // cm
  6: 1000, // m
  8: 0.0254, // micropulgadas (raro)
};

const UNIT_TO_MM: Record<Exclude<DxfUnit, "auto">, number> = {
  mm: 1,
  cm: 10,
  m: 1000,
  in: 25.4,
};

export interface GenerateOptions extends CarcasaParams {
  unit: DxfUnit;
  mirror: boolean;
}

export interface GenerateResult extends BuildResult {
  loopCount: number;
  unitMmUsed: number;
  skippedEntities: string[];
  sizeMm: { x: number; y: number };
}

export function generateCarcasaStl(dxfText: string, opts: GenerateOptions): GenerateResult {
  const { loops, insUnits, skipped } = extractContours(dxfText);
  if (!loops.length) {
    throw new Error(
      "No se encontraron contornos cerrados en el DXF. Asegúrate de exportar la letra como polilíneas/curvas cerradas.",
    );
  }

  // Factor de unidades → mm
  let unitMm: number;
  if (opts.unit === "auto") {
    unitMm = (insUnits != null && INSUNITS_TO_MM[insUnits]) || 1;
  } else {
    unitMm = UNIT_TO_MM[opts.unit];
  }

  const loopsMm: Pt[][] = loops.map((loop) =>
    loop.map((p) => ({ x: (opts.mirror ? -p.x : p.x) * unitMm, y: p.y * unitMm })),
  );

  const params: CarcasaParams = {
    depth: opts.depth,
    back: opts.back,
    wall: opts.wall,
    frontLip: opts.frontLip,
    acrylic: opts.acrylic,
  };

  const result = buildCarcasa(loopsMm, params);

  return {
    ...result,
    loopCount: loops.length,
    unitMmUsed: unitMm,
    skippedEntities: skipped,
    sizeMm: {
      x: result.bbox.max[0] - result.bbox.min[0],
      y: result.bbox.max[1] - result.bbox.min[1],
    },
  };
}
