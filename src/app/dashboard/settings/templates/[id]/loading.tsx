export default function EditTemplateLoading() {
  return (
    <div className="mx-auto max-w-3xl animate-pulse">
      <div className="mb-6 h-4 w-36 rounded bg-muted" />

      {/* Template form */}
      <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-4">
          <div className="space-y-2">
            <div className="h-4 w-20 rounded bg-muted" />
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
          <div className="space-y-2">
            <div className="h-4 w-24 rounded bg-muted" />
            <div className="h-10 w-full rounded-lg bg-muted" />
          </div>
          <div className="h-9 w-28 rounded-lg bg-muted" />
        </div>
      </div>

      {/* Checklist items */}
      <div className="rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="mb-4 h-5 w-32 rounded bg-muted" />
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-zinc-100 px-4 py-3 dark:border-zinc-800">
              <div className="h-4 flex-1 rounded bg-muted" />
              <div className="h-7 w-7 rounded bg-muted" />
              <div className="h-7 w-7 rounded bg-muted" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
