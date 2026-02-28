/** Color map for project type tag badges */
const TAG_COLORS: Record<string, string> = {
  Trofeos: "bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300",
  Maquetas: "bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300",
  Llaveros: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/40 dark:text-cyan-300",
  "Letras Corporeas": "bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300",
};

const TAG_DEFAULT_COLOR = "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300";

export function tagClasses(tag: string): string {
  return TAG_COLORS[tag] || TAG_DEFAULT_COLOR;
}
