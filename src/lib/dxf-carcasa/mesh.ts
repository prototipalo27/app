// Construye el sólido de la carcasa (bandeja tipo "channel letter") a partir de
// los bucles de la letra y lo serializa a STL binario.
//
// Sección vertical de una pared (de fuera hacia dentro):
//   - z 0 .. back            → placa de fondo (toda la silueta)
//   - z back .. (D - acrylic)→ pared perimetral (silueta erosionada `wall`)
//   - z (D-acrylic) .. D      → labio frontal (silueta erosionada `frontLip`)
// El escalón a z=(D-acrylic) es la repisa donde apoya el metacrilato.

import ClipperLib from "clipper-lib";
import earcut from "earcut";
import type { Pt } from "./contours";

const SCALE = 1e4; // enteros de clipper: 0.1 µm de resolución

export interface CarcasaParams {
  depth: number; // profundidad total (mm)
  back: number; // grosor del fondo (mm)
  wall: number; // grosor de pared (mm)
  frontLip: number; // pared que queda por delante del metacrilato (mm)
  acrylic: number; // grosor del metacrilato (mm)
}

export interface BuildResult {
  stl: ArrayBuffer;
  triangleCount: number;
  bbox: { min: [number, number, number]; max: [number, number, number] };
  warnings: string[];
}

type Path = { X: number; Y: number }[];
type Poly = { outer: Path; holes: Path[] };

// ── Clipper helpers ────────────────────────────────────

function toClipperPaths(loops: Pt[][]): Path[] {
  return loops
    .map((loop) => loop.map((p) => ({ X: Math.round(p.x * SCALE), Y: Math.round(p.y * SCALE) })))
    .filter((p) => p.length >= 3);
}

function unionEvenOdd(paths: Path[]): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(paths, ClipperLib.PolyType.ptSubject, true);
  const out: Path[] = [];
  c.Execute(
    ClipperLib.ClipType.ctUnion,
    out,
    ClipperLib.PolyFillType.pftEvenOdd,
    ClipperLib.PolyFillType.pftEvenOdd,
  );
  return out;
}

function erode(paths: Path[], deltaMm: number): Path[] {
  const co = new ClipperLib.ClipperOffset(2, 0.05 * SCALE);
  co.AddPaths(paths, ClipperLib.JoinType.jtRound, ClipperLib.EndType.etClosedPolygon);
  const out: Path[] = [];
  co.Execute(out, -deltaMm * SCALE);
  return out;
}

function difference(subj: Path[], clip: Path[]): Path[] {
  const c = new ClipperLib.Clipper();
  c.AddPaths(subj, ClipperLib.PolyType.ptSubject, true);
  if (clip.length) c.AddPaths(clip, ClipperLib.PolyType.ptClip, true);
  const out: Path[] = [];
  c.Execute(
    ClipperLib.ClipType.ctDifference,
    out,
    ClipperLib.PolyFillType.pftNonZero,
    ClipperLib.PolyFillType.pftNonZero,
  );
  return out;
}

// ── Agrupar contornos en polígonos (outer + holes) sin depender de PolyTree ──

function signedArea(p: Path): number {
  let a = 0;
  for (let i = 0, n = p.length; i < n; i++) {
    const q = p[(i + 1) % n];
    a += p[i].X * q.Y - q.X * p[i].Y;
  }
  return a / 2;
}

function pointInPath(pt: { X: number; Y: number }, path: Path): boolean {
  let inside = false;
  for (let i = 0, j = path.length - 1; i < path.length; j = i++) {
    const xi = path[i].X,
      yi = path[i].Y,
      xj = path[j].X,
      yj = path[j].Y;
    if (yi > pt.Y !== yj > pt.Y && pt.X < ((xj - xi) * (pt.Y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function buildPolys(paths: Path[]): Poly[] {
  const outers: { path: Path; area: number }[] = [];
  const holes: Path[] = [];
  for (const p of paths) {
    if (p.length < 3) continue;
    const a = signedArea(p);
    if (a > 0) outers.push({ path: p, area: a });
    else if (a < 0) holes.push(p);
  }
  const polys: Poly[] = outers.map((o) => ({ outer: o.path, holes: [] as Path[] }));
  for (const h of holes) {
    const probe = h[0];
    let best = -1;
    let bestArea = Infinity;
    for (let i = 0; i < outers.length; i++) {
      if (outers[i].area < bestArea && pointInPath(probe, outers[i].path)) {
        best = i;
        bestArea = outers[i].area;
      }
    }
    if (best >= 0) polys[best].holes.push(h);
  }
  return polys;
}

// ── Mallado ────────────────────────────────────────────

class Mesh {
  tris: number[] = []; // 9 floats por triángulo
  min: [number, number, number] = [Infinity, Infinity, Infinity];
  max: [number, number, number] = [-Infinity, -Infinity, -Infinity];

  private track(x: number, y: number, z: number) {
    if (x < this.min[0]) this.min[0] = x;
    if (y < this.min[1]) this.min[1] = y;
    if (z < this.min[2]) this.min[2] = z;
    if (x > this.max[0]) this.max[0] = x;
    if (y > this.max[1]) this.max[1] = y;
    if (z > this.max[2]) this.max[2] = z;
  }

  tri(a: number[], b: number[], c: number[]) {
    this.tris.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    this.track(a[0], a[1], a[2]);
    this.track(b[0], b[1], b[2]);
    this.track(c[0], c[1], c[2]);
  }
}

// Triangula una región plana (polígonos con huecos) a una altura z.
function triangulateRegion(polys: Poly[], z: number, faceUp: boolean, mesh: Mesh) {
  for (const poly of polys) {
    const coords: number[] = [];
    const holeIdx: number[] = [];
    const verts: Pt[] = [];
    for (const p of poly.outer) {
      verts.push({ x: p.X / SCALE, y: p.Y / SCALE });
      coords.push(p.X / SCALE, p.Y / SCALE);
    }
    for (const h of poly.holes) {
      holeIdx.push(verts.length);
      for (const p of h) {
        verts.push({ x: p.X / SCALE, y: p.Y / SCALE });
        coords.push(p.X / SCALE, p.Y / SCALE);
      }
    }
    const idx = earcut(coords, holeIdx.length ? holeIdx : undefined, 2);
    for (let i = 0; i < idx.length; i += 3) {
      const a = verts[idx[i]];
      const b = verts[idx[i + 1]];
      const c = verts[idx[i + 2]];
      // signo del área para orientar la normal (+z arriba / -z abajo)
      const area = (b.x - a.x) * (c.y - a.y) - (c.x - a.x) * (b.y - a.y);
      const ccw = area > 0;
      const wantCcw = faceUp; // arriba => CCW visto desde +z
      const va = [a.x, a.y, z];
      const vb = [b.x, b.y, z];
      const vc = [c.x, c.y, z];
      if (ccw === wantCcw) mesh.tri(va, vb, vc);
      else mesh.tri(va, vc, vb);
    }
  }
}

// Pared vertical a lo largo de un contorno. Con "material a la izquierda"
// (outer CCW / hole CW de clipper), outwardRight=true da normal hacia fuera.
function emitWalls(paths: Path[], zLow: number, zHigh: number, outwardRight: boolean, mesh: Mesh) {
  for (const path of paths) {
    const n = path.length;
    for (let i = 0; i < n; i++) {
      const p0 = path[i];
      const p1 = path[(i + 1) % n];
      const A = [p0.X / SCALE, p0.Y / SCALE, zLow];
      const B = [p1.X / SCALE, p1.Y / SCALE, zLow];
      const C = [p1.X / SCALE, p1.Y / SCALE, zHigh];
      const D = [p0.X / SCALE, p0.Y / SCALE, zHigh];
      if (outwardRight) {
        mesh.tri(A, B, C);
        mesh.tri(A, C, D);
      } else {
        mesh.tri(A, C, B);
        mesh.tri(A, D, C);
      }
    }
  }
}

// ── STL binario ────────────────────────────────────────

function toBinaryStl(tris: number[]): ArrayBuffer {
  const count = tris.length / 9;
  const buf = new ArrayBuffer(84 + count * 50);
  const view = new DataView(buf);
  view.setUint32(80, count, true);
  let off = 84;
  for (let t = 0; t < count; t++) {
    const i = t * 9;
    const ax = tris[i],
      ay = tris[i + 1],
      az = tris[i + 2];
    const bx = tris[i + 3],
      by = tris[i + 4],
      bz = tris[i + 5];
    const cx = tris[i + 6],
      cy = tris[i + 7],
      cz = tris[i + 8];
    // normal por producto vectorial
    const ux = bx - ax,
      uy = by - ay,
      uz = bz - az;
    const vx = cx - ax,
      vy = cy - ay,
      vz = cz - az;
    let nx = uy * vz - uz * vy;
    let ny = uz * vx - ux * vz;
    let nz = ux * vy - uy * vx;
    const len = Math.hypot(nx, ny, nz) || 1;
    nx /= len;
    ny /= len;
    nz /= len;
    view.setFloat32(off, nx, true);
    view.setFloat32(off + 4, ny, true);
    view.setFloat32(off + 8, nz, true);
    view.setFloat32(off + 12, ax, true);
    view.setFloat32(off + 16, ay, true);
    view.setFloat32(off + 20, az, true);
    view.setFloat32(off + 24, bx, true);
    view.setFloat32(off + 28, by, true);
    view.setFloat32(off + 32, bz, true);
    view.setFloat32(off + 36, cx, true);
    view.setFloat32(off + 40, cy, true);
    view.setFloat32(off + 44, cz, true);
    off += 50;
  }
  return buf;
}

// ── Orquestador de la malla ────────────────────────────

export function buildCarcasa(loopsMm: Pt[][], params: CarcasaParams): BuildResult {
  const { depth, back, wall, frontLip, acrylic } = params;
  const warnings: string[] = [];
  const ledgeZ = depth - acrylic; // altura de la repisa del metacrilato

  const raw = toClipperPaths(loopsMm);
  if (!raw.length) throw new Error("El DXF no contiene contornos cerrados válidos.");

  const F = unionEvenOdd(raw);
  if (!F.length) throw new Error("No se pudo reconstruir la silueta de la letra.");

  const Cwall = erode(F, wall);
  const Clip = erode(F, frontLip);

  if (!Clip.length) {
    warnings.push(
      "La letra es demasiado fina para el labio frontal: saldrá maciza sin hueco para el metacrilato.",
    );
  } else if (!Cwall.length) {
    warnings.push("La letra es muy fina: no queda hueco interior tras la pared de " + wall + " mm.");
  }

  // Regiones horizontales por altura
  const R35 = buildPolys(difference(F, Clip)); // top = depth
  const R33 = buildPolys(difference(Clip, Cwall)); // top = ledgeZ
  const R2 = buildPolys(Cwall.length ? unionEvenOdd(Cwall) : []); // top = back
  const Fpolys = buildPolys(F);

  const mesh = new Mesh();

  // Fondo (silueta completa) mirando hacia -z
  triangulateRegion(Fpolys, 0, false, mesh);

  // Piel exterior (todo el borde de la letra), altura completa
  emitWalls(F, 0, depth, true, mesh);

  // Caras superiores
  triangulateRegion(R35, depth, true, mesh);
  if (R33.length) triangulateRegion(R33, ledgeZ, true, mesh);
  if (R2.length) triangulateRegion(R2, back, true, mesh);

  // Escalón del metacrilato (borde de Clip): de ledgeZ a depth, mirando hacia dentro
  if (Clip.length) emitWalls(Clip, ledgeZ, depth, false, mesh);
  // Escalón interior de la pared (borde de Cwall): de back a ledgeZ, mirando hacia dentro
  if (Cwall.length) emitWalls(Cwall, back, ledgeZ, false, mesh);

  const stl = toBinaryStl(mesh.tris);
  return {
    stl,
    triangleCount: mesh.tris.length / 9,
    bbox: { min: mesh.min, max: mesh.max },
    warnings,
  };
}
