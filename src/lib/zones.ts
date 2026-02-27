export const ZONES = [
  { id: "design", label: "Design", color: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400" },
  { id: "printing", label: "Printing", color: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400" },
  { id: "post_processing", label: "Post-processing / Laser", color: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" },
  { id: "qc", label: "QC", color: "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400" },
  { id: "shipping", label: "Shipping", color: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400" },
];

export function getZoneColor(zone: string): string {
  return ZONES.find((z) => z.id === zone)?.color ?? "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300";
}

export function getZoneLabel(zone: string): string {
  return ZONES.find((z) => z.id === zone)?.label ?? zone;
}
