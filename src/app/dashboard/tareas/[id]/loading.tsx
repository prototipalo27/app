export default function TaskDetailLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 h-4 w-32 rounded bg-muted" />
      <div className="mb-6 h-8 w-64 rounded bg-muted" />

      {/* Info cards grid */}
      <div className="mb-6 grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-3 w-16 rounded bg-muted" />
            <div className="mt-2 h-5 w-24 rounded bg-muted" />
          </div>
        ))}
      </div>

      {/* Description card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-3 h-5 w-28 rounded bg-muted" />
        <div className="space-y-2">
          <div className="h-4 w-full rounded bg-muted" />
          <div className="h-4 w-4/5 rounded bg-muted" />
          <div className="h-4 w-3/5 rounded bg-muted" />
        </div>
      </div>
    </div>
  );
}
