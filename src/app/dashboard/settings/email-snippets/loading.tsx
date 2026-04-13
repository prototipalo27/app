export default function EmailSnippetsLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="mb-6 flex items-center gap-3">
        <div className="h-4 w-28 rounded bg-muted" />
      </div>
      <div className="mb-6 h-8 w-48 rounded bg-muted" />

      {/* New snippet form */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="flex gap-3">
          <div className="h-10 w-28 rounded-lg bg-muted" />
          <div className="h-10 flex-1 rounded-lg bg-muted" />
          <div className="h-10 w-20 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Grouped snippets */}
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="mb-6">
          <div className="mb-2 h-4 w-20 rounded bg-muted" />
          <div className="space-y-2">
            {Array.from({ length: 2 }).map((_, j) => (
              <div key={j} className="flex items-center justify-between rounded-lg border border-zinc-200 px-4 py-3 dark:border-zinc-800">
                <div className="h-4 w-48 rounded bg-muted" />
                <div className="flex gap-2">
                  <div className="h-7 w-14 rounded bg-muted" />
                  <div className="h-7 w-14 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}
