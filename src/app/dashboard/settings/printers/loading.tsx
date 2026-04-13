export default function PrinterSettingsLoading() {
  return (
    <div className="animate-pulse">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <div className="h-8 w-52 rounded bg-muted" />
          <div className="mt-2 h-4 w-96 rounded bg-muted" />
        </div>
        <div className="h-10 w-32 rounded-lg bg-muted" />
      </div>

      {/* Printer hours form */}
      <div className="space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-xl border border-zinc-200 bg-white px-5 py-4 dark:border-zinc-800 dark:bg-zinc-900">
            <div className="h-5 w-32 rounded bg-muted" />
            <div className="h-5 w-20 rounded bg-muted" />
            <div className="ml-auto h-10 w-28 rounded-lg bg-muted" />
          </div>
        ))}
      </div>
    </div>
  );
}
