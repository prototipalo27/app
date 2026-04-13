export default function NewRequestLoading() {
  return (
    <div className="mx-auto max-w-2xl animate-pulse">
      <div className="mb-6">
        <div className="h-4 w-36 rounded bg-muted" />
        <div className="mt-2 h-8 w-48 rounded bg-muted" />
      </div>

      <div className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-16 rounded bg-muted" />
          <div className="h-10 w-full rounded-lg bg-muted" />
        </div>
        <div className="space-y-2">
          <div className="h-4 w-24 rounded bg-muted" />
          <div className="h-32 w-full rounded-lg bg-muted" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-muted" />
      </div>
    </div>
  );
}
