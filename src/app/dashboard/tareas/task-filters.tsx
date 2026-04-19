"use client";

import { useRouter } from "next/navigation";

const STATUS_TABS = [
  { value: "all", label: "Todas" },
  { value: "pending", label: "Pendientes" },
  { value: "in_progress", label: "En curso" },
  { value: "done", label: "Hechas" },
];

export function TaskFilters({
  currentStatus,
  showMine,
  isManager,
}: {
  currentStatus: string;
  showMine: boolean;
  isManager: boolean;
}) {
  const router = useRouter();

  function navigate(status: string, mine: boolean) {
    const params = new URLSearchParams();
    if (status !== "all") params.set("status", status);
    if (mine && isManager) params.set("mine", "true");
    const qs = params.toString();
    router.push("/dashboard/tareas" + (qs ? `?${qs}` : ""));
  }

  return (
    <div className="mb-4 flex flex-wrap items-center gap-2">
      <div className="flex rounded-lg border border-zinc-200 dark:border-zinc-700">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => navigate(tab.value, showMine)}
            className={`px-3 py-1.5 text-xs font-medium transition-colors ${
              currentStatus === tab.value
                ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                : "text-zinc-600 hover:bg-zinc-100 dark:text-zinc-400 dark:hover:bg-zinc-800"
            } first:rounded-l-lg last:rounded-r-lg`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {isManager && (
        <button
          onClick={() => navigate(currentStatus, !showMine)}
          className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors ${
            showMine
              ? "border-green-500 bg-green-50 text-green-700 dark:border-green-600 dark:bg-green-900/20 dark:text-green-400"
              : "border-zinc-200 text-zinc-600 hover:bg-zinc-100 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
          }`}
        >
          Solo mis tareas
        </button>
      )}
    </div>
  );
}
