export default function Loading() {
  return (
    <div className="mx-auto max-w-5xl animate-pulse">
      <div className="mb-4 flex items-center gap-2">
        <div className="h-8 w-20 rounded bg-muted" />
        <div className="h-4 w-16 rounded bg-muted" />
        <div className="h-8 w-20 rounded bg-muted" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="space-y-4 md:col-span-2">
          <div className="rounded-xl border bg-card p-6">
            <div className="mb-3 flex gap-2">
              <div className="h-5 w-20 rounded bg-muted" />
              <div className="h-5 w-16 rounded bg-muted" />
            </div>
            <div className="h-6 w-48 rounded bg-muted" />
            <div className="mt-2 h-4 w-32 rounded bg-muted" />
            <div className="mt-4 space-y-2">
              <div className="h-4 w-56 rounded bg-muted" />
              <div className="h-4 w-40 rounded bg-muted" />
            </div>
          </div>
        </div>
        <div className="rounded-xl border bg-card p-6">
          <div className="space-y-3">
            <div className="h-8 w-full rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
            <div className="h-8 w-full rounded bg-muted" />
          </div>
        </div>
      </div>
    </div>
  );
}
