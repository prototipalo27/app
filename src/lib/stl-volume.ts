/**
 * Calculate volume of an STL file using the signed tetrahedron method.
 * Works with both ASCII and binary STL formats.
 * Runs client-side (browser).
 */

function signedVolumeOfTriangle(
  p1: [number, number, number],
  p2: [number, number, number],
  p3: [number, number, number]
): number {
  return (
    p1[0] * (p2[1] * p3[2] - p2[2] * p3[1]) +
    p1[1] * (p2[2] * p3[0] - p2[0] * p3[2]) +
    p1[2] * (p2[0] * p3[1] - p2[1] * p3[0])
  ) / 6.0;
}

function parseBinarySTL(buffer: ArrayBuffer): number {
  const view = new DataView(buffer);
  const numTriangles = view.getUint32(80, true);
  let volume = 0;

  for (let i = 0; i < numTriangles; i++) {
    const offset = 84 + i * 50;
    // Skip normal (12 bytes), read 3 vertices (each 3 floats = 12 bytes)
    const v1: [number, number, number] = [
      view.getFloat32(offset + 12, true),
      view.getFloat32(offset + 16, true),
      view.getFloat32(offset + 20, true),
    ];
    const v2: [number, number, number] = [
      view.getFloat32(offset + 24, true),
      view.getFloat32(offset + 28, true),
      view.getFloat32(offset + 32, true),
    ];
    const v3: [number, number, number] = [
      view.getFloat32(offset + 36, true),
      view.getFloat32(offset + 40, true),
      view.getFloat32(offset + 44, true),
    ];
    volume += signedVolumeOfTriangle(v1, v2, v3);
  }

  return Math.abs(volume);
}

function isAsciiSTL(buffer: ArrayBuffer): boolean {
  const header = new TextDecoder().decode(buffer.slice(0, 80));
  return header.trimStart().startsWith("solid") && buffer.byteLength > 84;
}

function parseAsciiSTL(text: string): number {
  let volume = 0;
  const vertexRegex = /vertex\s+([\d.eE+-]+)\s+([\d.eE+-]+)\s+([\d.eE+-]+)/g;
  const vertices: [number, number, number][] = [];

  let match;
  while ((match = vertexRegex.exec(text)) !== null) {
    vertices.push([
      parseFloat(match[1]),
      parseFloat(match[2]),
      parseFloat(match[3]),
    ]);

    if (vertices.length === 3) {
      volume += signedVolumeOfTriangle(vertices[0], vertices[1], vertices[2]);
      vertices.length = 0;
    }
  }

  return Math.abs(volume);
}

/**
 * Calculate volume from STL ArrayBuffer.
 * @returns Volume in cm3 (STL is assumed to be in mm)
 */
export function calculateSTLVolumeCm3(buffer: ArrayBuffer): number {
  let volumeMm3: number;

  if (isAsciiSTL(buffer)) {
    const text = new TextDecoder().decode(buffer);
    volumeMm3 = parseAsciiSTL(text);
  } else {
    volumeMm3 = parseBinarySTL(buffer);
  }

  // Convert mm3 to cm3
  return volumeMm3 / 1000;
}
