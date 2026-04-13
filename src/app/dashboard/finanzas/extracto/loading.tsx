export default function ExtractoLoading() {
  return (
    <div className="mx-auto max-w-6xl animate-pulse">
      <div className="mb-6">
        <div className="h-8 w-56 rounded bg-muted" />
        <div className="mt-2 h-4 w-96 rounded bg-muted" />
      </div>

      {/* Statement processor skeleton */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-6 flex items-center gap-4">
          <div className="h-10 w-48 rounded-lg bg-muted" />
          <div className="h-10 w-36 rounded-lg bg-muted" />
        </div>
        <div className="space-y-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex gap-4 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800/50">
              <div className="h-4 w-24 rounded bg-muted" />
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-4 w-20 rounded bg-muted" />
              <div className="h-4 w-24 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
