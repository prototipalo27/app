/**
 * Slugify a company name for use in a filename:
 * lowercase, drop punctuation (commas, dots), collapse separators to single dashes.
 */
export function slugifyCompany(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}
