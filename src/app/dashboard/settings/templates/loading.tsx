export default function TemplatesLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="mb-6 h-8 w-56 rounded bg-muted" />

      {/* New template form */}
      <div className="mb-6 flex gap-3 rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="h-10 flex-1 rounded-lg bg-muted" />
        <div className="h-10 flex-1 rounded-lg bg-muted" />
        <div className="h-10 w-24 rounded-lg bg-muted" />
      </div>

      {/* Template list */}
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex items-center justify-between rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-1.5">
              <div className="h-5 w-40 rounded bg-muted" />
              <div className="h-3 w-24 rounded bg-muted" />
            </div>
            <div className="flex gap-2">
              <div className="h-8 w-16 rounded bg-muted" />
              <div className="h-8 w-16 rounded bg-muted" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
