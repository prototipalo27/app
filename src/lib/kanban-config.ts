export type ProjectStatus =
  | "pending"
  | "design"
  | "printing"
  | "post_processing"
  | "qc"
  | "shipping"
  | "delivered";

export const COLUMNS: {
  id: ProjectStatus;
  label: string;
  accent: string;
  badge: string;
}[] = [
  {
    id: "pending",
    label: "Pedidos Nuevos",
    accent: "bg-zinc-400",
    badge: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-300",
  },
  {
    id: "design",
    label: "Design",
    accent: "bg-purple-500",
    badge:
      "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  },
  {
    id: "printing",
    label: "Printing",
    accent: "bg-blue-500",
    badge: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  },
  {
    id: "post_processing",
    label: "Post-processing",
    accent: "bg-yellow-500",
    badge:
      "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
  },
  {
    id: "qc",
    label: "QC",
    accent: "bg-orange-500",
    badge:
      "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400",
  },
  {
    id: "shipping",
    label: "Shipping",
    accent: "bg-cyan-500",
    badge: "bg-cyan-100 text-cyan-700 dark:bg-cyan-900/30 dark:text-cyan-400",
  },
  {
    id: "delivered",
    label: "Delivered",
    accent: "bg-green-500",
    badge:
      "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
  },
];
