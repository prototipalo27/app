export default function RequestDetailLoading() {
  return (
    <div className="mx-auto max-w-4xl animate-pulse">
      <div className="mb-6 h-4 w-36 rounded bg-muted" />

      <div className="grid gap-6 md:grid-cols-3">
        {/* Main content */}
        <div className="space-y-4 md:col-span-2">
          <div className="flex items-center gap-2">
            <div className="h-6 w-20 rounded-full bg-muted" />
            <div className="h-6 w-16 rounded-full bg-muted" />
            <div className="h-6 w-16 rounded-full bg-muted" />
          </div>
          <div className="h-8 w-3/4 rounded bg-muted" />
          <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="space-y-3">
              <div className="h-4 w-full rounded bg-muted" />
              <div className="h-4 w-5/6 rounded bg-muted" />
              <div className="h-4 w-2/3 rounded bg-muted" />
            </div>
          </div>
          {/* Timeline */}
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="flex gap-3">
                <div className="h-6 w-6 rounded-full bg-muted" />
                <div className="flex-1 space-y-1">
                  <div className="h-4 w-48 rounded bg-muted" />
                  <div className="h-3 w-24 rounded bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Sidebar */}
        <div className="space-y-3">
          <div className="h-10 w-full rounded-lg bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
      </div>
    </div>
  );
}
