export default function SupplierDetailLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-4 w-32 rounded bg-muted" />
      <div className="h-8 w-56 rounded bg-muted" />

      {/* Edit form card */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-4">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Payments table */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 h-5 w-32 rounded bg-muted" />
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="flex gap-4 border-b border-zinc-100 py-3 last:border-0 dark:border-zinc-800/50">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-4 flex-1 rounded bg-muted" />
            <div className="h-4 w-20 rounded bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
