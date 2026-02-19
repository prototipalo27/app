/**
 * Naming convention for print job gcode files.
 * Format: PRJ-{6chars}-{itemSlug}-B{batch}.3mf
 * Example: PRJ-a1b2c3-MainBody-B1.3mf
 */

/**
 * Convert an item name to a URL-safe slug (PascalCase, no spaces/special chars).
 */
function slugify(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9\s]/g, "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join("");
}

/**
 * Generate a gcode filename for a print job.
 * @param projectId - full UUID of the project
 * @param itemName - human-readable item name
 * @param batchNumber - 1-indexed batch number
 */
export function generateJobFilename(
  projectId: string,
  itemName: string,
  batchNumber: number
): string {
  const shortId = projectId.replace(/-/g, "").slice(0, 6);
  const slug = slugify(itemName) || "Item";
  return `PRJ-${shortId}-${slug}-B${batchNumber}.3mf`;
}

/**
 * Parse a gcode filename back into its components.
 * Returns null if the filename doesn't match the expected pattern.
 */
export function parseJobFilename(
  filename: string
): { projectShortId: string; itemSlug: string; batchNumber: number } | null {
  const match = filename.match(/^PRJ-([a-f0-9]{6})-(.+)-B(\d+)\.3mf$/i);
  if (!match) return null;
  return {
    projectShortId: match[1],
    itemSlug: match[2],
    batchNumber: parseInt(match[3], 10),
  };
}
