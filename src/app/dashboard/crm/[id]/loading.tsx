export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      {/* Nav */}
      <div className="mb-6 flex items-center justify-between">
        <div className="h-4 w-24 rounded bg-muted" />
        <div className="flex gap-1">
          <div className="h-8 w-16 rounded-md bg-muted" />
          <div className="h-8 w-16 rounded-md bg-muted" />
        </div>
      </div>

      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          {/* Lead info card */}
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-3 flex flex-wrap gap-2">
              <div className="h-5 w-20 rounded-full bg-muted" />
              <div className="h-5 w-16 rounded-full bg-muted" />
              <div className="ml-auto h-5 w-32 rounded bg-muted" />
            </div>
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="mt-1 h-4 w-32 rounded bg-muted" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-40 rounded bg-muted" />
              <div className="h-4 w-36 rounded bg-muted" />
            </div>
            {/* Quick-action buttons on mobile */}
            <div className="mt-3 flex gap-2 md:hidden">
              <div className="h-10 flex-1 rounded-lg bg-muted" />
              <div className="h-10 flex-1 rounded-lg bg-muted" />
              <div className="h-10 w-12 rounded-lg bg-muted" />
            </div>
          </div>

          {/* Actions panel on mobile */}
          <div className="rounded-xl border bg-card p-6 md:hidden">
            <div className="space-y-3">
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-full rounded bg-muted" />
              <div className="h-8 w-3/4 rounded bg-muted" />
            </div>
          </div>
        </div>

        {/* Desktop sidebar */}
        <div className="hidden rounded-xl border bg-card p-6 md:block">
          <div className="space-y-3">
            <div className="h-8 w-full rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
            <div className="h-8 w-3/4 rounded bg-muted" />
            <div className="h-24 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
