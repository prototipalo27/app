export default function SuppliersLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="flex items-center justify-between">
        <div className="h-7 w-36 rounded bg-muted" />
        <div className="h-9 w-40 rounded-lg bg-muted" />
      </div>

      {/* Table skeleton */}
      <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-4 border-b border-zinc-200 px-4 py-3 dark:border-zinc-800">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-4 flex-1 rounded bg-muted" />
          ))}
        </div>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-zinc-100 px-4 py-3 last:border-0 dark:border-zinc-800/50">
            {Array.from({ length: 4 }).map((_, j) => (
              <div key={j} className="h-4 flex-1 rounded bg-muted" />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
