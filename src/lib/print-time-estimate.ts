/**
 * Estimate print time from STL volume.
 */

const BASE_MINUTES = 10; // Warmup/setup overhead

const RATE_PER_MATERIAL: Record<string, number> = {
  PLA: 0.8,
  PETG: 1.0,
  ABS: 1.0,
  TPU: 1.5,
};

/**
 * Estimate print time in minutes from volume.
 * @param volumeCm3 Volume in cm3
 * @param material Material type (defaults to PLA)
 * @returns Estimated minutes (rounded up)
 */
export function estimatePrintMinutes(
  volumeCm3: number,
  material: string = "PLA"
): number {
  const rate = RATE_PER_MATERIAL[material.toUpperCase()] ?? 1.0;
  return Math.ceil(BASE_MINUTES + volumeCm3 * rate);
}

export const SUPPORTED_MATERIALS = Object.keys(RATE_PER_MATERIAL);
