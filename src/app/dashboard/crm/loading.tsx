export default function CrmLoading() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col overflow-hidden animate-pulse">
      {/* Header */}
      <div className="mb-4 flex shrink-0 items-center justify-between">
        <div>
          <div className="h-7 w-32 rounded bg-zinc-200 dark:bg-zinc-800" />
          <div className="mt-2 h-4 w-56 rounded bg-zinc-200 dark:bg-zinc-800" />
        </div>
        <div className="h-9 w-28 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Kanban columns */}
      <div className="flex min-h-0 flex-1 gap-4 overflow-hidden">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex min-w-0 flex-1 flex-col rounded-xl bg-zinc-100 dark:bg-zinc-900 p-3">
            <div className="mb-3 h-5 w-20 rounded bg-zinc-200 dark:bg-zinc-800" />
            <div className="space-y-3">
              {Array.from({ length: 2 + (i % 2) }).map((_, j) => (
                <div key={j} className="rounded-lg bg-white dark:bg-zinc-800 p-3 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-zinc-200 dark:bg-zinc-700" />
                  <div className="h-3 w-1/2 rounded bg-zinc-200 dark:bg-zinc-700" />
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
