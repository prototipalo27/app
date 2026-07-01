// Extrae contornos cerrados (polígonos) a partir del texto de un DXF.
// Teselamos arcos, círculos, elipses, bulges de polilíneas y splines,
// y cosemos segmentos sueltos (LINE/ARC/SPLINE) en bucles cerrados.

import DxfParser from "dxf-parser";

export interface Pt {
  x: number;
  y: number;
}

export interface ContourResult {
  /** Bucles cerrados en coordenadas del DXF (mm si el archivo está en mm). */
  loops: Pt[][];
  /** Código de $INSUNITS del header, si existe. */
  insUnits: number | null;
  /** Entidades que no se pudieron interpretar (para avisar al usuario). */
  skipped: string[];
}

const ANGLE_STEP = (1.5 * Math.PI) / 180; // ~1.5° por segmento en arcos
const STITCH_TOL = 0.05; // mm: tolerancia para unir extremos de segmentos

function tessellateArc(
  cx: number,
  cy: number,
  r: number,
  a0: number,
  a1: number,
  ccw = true,
): Pt[] {
  let start = a0;
  let end = a1;
  if (ccw) {
    while (end < start) end += Math.PI * 2;
  } else {
    while (end > start) end -= Math.PI * 2;
  }
  const sweep = Math.abs(end - start);
  const steps = Math.max(2, Math.ceil(sweep / ANGLE_STEP));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const a = start + ((end - start) * i) / steps;
    pts.push({ x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) });
  }
  return pts;
}

// Segmento de polilínea con bulge (arco tangente definido por el "bulge").
function bulgeArc(p0: Pt, p1: Pt, bulge: number): Pt[] {
  if (!bulge) return [p0, p1];
  const dx = p1.x - p0.x;
  const dy = p1.y - p0.y;
  const chord = Math.hypot(dx, dy);
  if (chord < 1e-9) return [p0, p1];
  const theta = 4 * Math.atan(bulge); // ángulo total del arco (con signo)
  const r = chord / (2 * Math.sin(Math.abs(theta) / 2));
  const mid = { x: (p0.x + p1.x) / 2, y: (p0.y + p1.y) / 2 };
  // distancia del centro a la cuerda
  const h = r * Math.cos(Math.abs(theta) / 2);
  const dir = bulge > 0 ? 1 : -1; // izquierda/derecha respecto a la dirección de la cuerda
  const nx = -dy / chord;
  const ny = dx / chord;
  const cx = mid.x + dir * h * nx;
  const cy = mid.y + dir * h * ny;
  const a0 = Math.atan2(p0.y - cy, p0.x - cx);
  const a1 = Math.atan2(p1.y - cy, p1.x - cx);
  const pts = tessellateArc(cx, cy, r, a0, a1, bulge > 0);
  return pts;
}

function ellipsePoints(e: any): Pt[] {
  const cx = e.center?.x ?? 0;
  const cy = e.center?.y ?? 0;
  const mx = e.majorAxisEndPoint?.x ?? 0;
  const my = e.majorAxisEndPoint?.y ?? 0;
  const major = Math.hypot(mx, my);
  const minor = major * (e.axisRatio ?? 1);
  const rot = Math.atan2(my, mx);
  const start = e.startAngle ?? 0;
  const end = e.endAngle ?? Math.PI * 2;
  let sweep = end - start;
  if (sweep <= 1e-9) sweep += Math.PI * 2;
  const steps = Math.max(8, Math.ceil(sweep / ANGLE_STEP));
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = start + (sweep * i) / steps;
    const ex = major * Math.cos(t);
    const ey = minor * Math.sin(t);
    pts.push({
      x: cx + ex * Math.cos(rot) - ey * Math.sin(rot),
      y: cy + ex * Math.sin(rot) + ey * Math.cos(rot),
    });
  }
  return pts;
}

// Evaluación de B-spline por de Boor para teselar SPLINE con puntos de control.
function splinePoints(sp: any): Pt[] {
  const ctrl: Pt[] = (sp.controlPoints ?? []).map((p: any) => ({ x: p.x, y: p.y }));
  const fit: Pt[] = (sp.fitPoints ?? []).map((p: any) => ({ x: p.x, y: p.y }));
  if (ctrl.length < 2) {
    return fit.length >= 2 ? fit : [];
  }
  const degree = sp.degreeOfSplineCurve ?? 3;
  let knots: number[] = sp.knotValues ?? [];
  const n = ctrl.length - 1;
  if (knots.length !== n + degree + 2) {
    // knot vector clamped uniforme por defecto
    knots = [];
    for (let i = 0; i <= n + degree + 1; i++) {
      if (i <= degree) knots.push(0);
      else if (i >= n + 1) knots.push(n - degree + 1);
      else knots.push(i - degree);
    }
  }
  const deBoor = (t: number): Pt => {
    let k = degree;
    while (k < knots.length - degree - 1 && t >= knots[k + 1]) k++;
    const d: Pt[] = [];
    for (let j = 0; j <= degree; j++) {
      const cp = ctrl[Math.min(Math.max(k - degree + j, 0), n)];
      d[j] = { x: cp.x, y: cp.y };
    }
    for (let r = 1; r <= degree; r++) {
      for (let j = degree; j >= r; j--) {
        const i = k - degree + j;
        const denom = knots[i + degree - r + 1] - knots[i];
        const alpha = denom === 0 ? 0 : (t - knots[i]) / denom;
        d[j] = {
          x: (1 - alpha) * d[j - 1].x + alpha * d[j].x,
          y: (1 - alpha) * d[j - 1].y + alpha * d[j].y,
        };
      }
    }
    return d[degree];
  };
  const t0 = knots[degree];
  const t1 = knots[knots.length - degree - 1];
  const steps = Math.max(16, ctrl.length * 8);
  const pts: Pt[] = [];
  for (let i = 0; i <= steps; i++) {
    const t = t0 + ((t1 - t0) * i) / steps;
    pts.push(deBoor(Math.min(t, t1 - 1e-9)));
  }
  return pts;
}

// Normaliza ángulos de dxf-parser: algunas versiones dan grados, otras radianes.
function toRad(a: number): number {
  return Math.abs(a) > Math.PI * 2 + 1e-6 ? (a * Math.PI) / 180 : a;
}

function isClosedPoly(e: any): boolean {
  return Boolean(e.closed || e.shape || (typeof e.flags === "number" && e.flags & 1));
}

function polyPoints(e: any): { pts: Pt[]; closed: boolean } {
  const verts = e.vertices ?? [];
  const closed = isClosedPoly(e);
  const pts: Pt[] = [];
  for (let i = 0; i < verts.length; i++) {
    const v = verts[i];
    const next = verts[i + 1] ?? (closed ? verts[0] : null);
    if (v.bulge && next) {
      const arc = bulgeArc({ x: v.x, y: v.y }, { x: next.x, y: next.y }, v.bulge);
      // evitar duplicar el punto final (lo añade la siguiente iteración)
      for (let j = 0; j < arc.length - 1; j++) pts.push(arc[j]);
    } else {
      pts.push({ x: v.x, y: v.y });
    }
  }
  return { pts, closed };
}

// Une segmentos abiertos en bucles cerrados por proximidad de extremos.
function stitch(segments: Pt[][], tol: number): Pt[][] {
  const key = (p: Pt) => `${Math.round(p.x / tol)}:${Math.round(p.y / tol)}`;
  const used = new Array(segments.length).fill(false);
  const loops: Pt[][] = [];

  for (let s = 0; s < segments.length; s++) {
    if (used[s]) continue;
    used[s] = true;
    const loop = [...segments[s]];
    let extended = true;
    while (extended) {
      extended = false;
      const tail = loop[loop.length - 1];
      const head = loop[0];
      for (let t = 0; t < segments.length; t++) {
        if (used[t]) continue;
        const seg = segments[t];
        const a = seg[0];
        const b = seg[seg.length - 1];
        if (key(tail) === key(a)) {
          for (let i = 1; i < seg.length; i++) loop.push(seg[i]);
          used[t] = true;
          extended = true;
          break;
        }
        if (key(tail) === key(b)) {
          for (let i = seg.length - 2; i >= 0; i--) loop.push(seg[i]);
          used[t] = true;
          extended = true;
          break;
        }
        if (key(head) === key(b)) {
          for (let i = seg.length - 2; i >= 0; i--) loop.unshift(seg[i]);
          used[t] = true;
          extended = true;
          break;
        }
        if (key(head) === key(a)) {
          for (let i = 1; i < seg.length; i++) loop.unshift(seg[i]);
          used[t] = true;
          extended = true;
          break;
        }
      }
    }
    if (loop.length >= 3) loops.push(loop);
  }
  return loops;
}

export function extractContours(dxfText: string): ContourResult {
  const parser = new DxfParser();
  const dxf: any = parser.parseSync(dxfText);
  if (!dxf) throw new Error("No se pudo leer el DXF");

  const insUnits =
    dxf.header && typeof dxf.header.$INSUNITS === "number" ? dxf.header.$INSUNITS : null;

  const closedLoops: Pt[][] = [];
  const openSegments: Pt[][] = [];
  const skipped: string[] = [];

  for (const e of dxf.entities ?? []) {
    switch (e.type) {
      case "LWPOLYLINE":
      case "POLYLINE": {
        const { pts, closed } = polyPoints(e);
        if (pts.length < 2) break;
        if (closed) closedLoops.push(pts);
        else openSegments.push(pts);
        break;
      }
      case "LINE": {
        const v = e.vertices ?? [];
        if (v.length >= 2) openSegments.push([{ x: v[0].x, y: v[0].y }, { x: v[1].x, y: v[1].y }]);
        break;
      }
      case "CIRCLE": {
        const c = e.center ?? { x: 0, y: 0 };
        closedLoops.push(tessellateArc(c.x, c.y, e.radius, 0, Math.PI * 2, true));
        break;
      }
      case "ARC": {
        const c = e.center ?? { x: 0, y: 0 };
        openSegments.push(
          tessellateArc(c.x, c.y, e.radius, toRad(e.startAngle), toRad(e.endAngle), true),
        );
        break;
      }
      case "ELLIPSE": {
        const pts = ellipsePoints(e);
        // cerrada si barre 2π
        const sweep = (e.endAngle ?? Math.PI * 2) - (e.startAngle ?? 0);
        if (Math.abs(Math.abs(sweep) - Math.PI * 2) < 1e-3 || (e.startAngle == null && e.endAngle == null))
          closedLoops.push(pts);
        else openSegments.push(pts);
        break;
      }
      case "SPLINE": {
        const pts = splinePoints(e);
        if (pts.length < 2) break;
        const closed = Boolean(e.closed) || (typeof e.flags === "number" && e.flags & 1);
        if (closed) closedLoops.push(pts);
        else openSegments.push(pts);
        break;
      }
      default:
        if (e.type) skipped.push(e.type);
    }
  }

  const stitched = stitch(openSegments, STITCH_TOL);
  return {
    loops: [...closedLoops, ...stitched],
    insUnits,
    skipped: [...new Set(skipped)],
  };
}
