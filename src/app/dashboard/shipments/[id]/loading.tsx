export default function ShipmentDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-28 rounded bg-muted" />
      <div className="h-8 w-48 rounded bg-muted" />

      {/* Info card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="space-y-1.5">
              <div className="h-3 w-20 rounded bg-muted" />
              <div className="h-10 rounded-lg bg-muted" />
            </div>
          ))}
        </div>
        <div className="mt-6 h-9 w-28 rounded-lg bg-muted" />
      </div>

      {/* Products section */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 h-5 w-24 rounded bg-muted" />
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800/50">
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-16 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
