export default function ShipmentsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-28 rounded bg-zinc-200 dark:bg-zinc-800" />
        <div className="h-9 w-32 rounded-lg bg-zinc-200 dark:bg-zinc-800" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        {/* Header row */}
        <div className="flex gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-zinc-200 dark:bg-zinc-700" />
          ))}
        </div>
        {/* Data rows */}
        {Array.from({ length: 8 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800/50">
            {Array.from({ length: 5 }).map((_, j) => (
              <div key={j} className="h-4 flex-1 rounded bg-zinc-100 dark:bg-zinc-800" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
