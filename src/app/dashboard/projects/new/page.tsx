import { createProject } from "../actions";
import Link from "next/link";

const MATERIALS = ["PLA", "PETG", "ASA", "ABS", "TPU", "Nylon", "PC", "Resin"];

export default function NewProjectPage() {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="mb-6">
        <Link
          href="/dashboard"
          className="text-sm text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-200"
        >
          &larr; Back to projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-zinc-900 dark:text-white">
          New project
        </h1>
      </div>

      <form action={createProject} className="space-y-6 rounded-xl border border-zinc-200 bg-white p-6 dark:border-zinc-800 dark:bg-zinc-900">
        {/* Name */}
        <div>
          <label htmlFor="name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Project name *
          </label>
          <input
            type="text"
            id="name"
            name="name"
            required
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            placeholder="e.g. Custom enclosure for Client X"
          />
        </div>

        {/* Description */}
        <div>
          <label htmlFor="description" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Description
          </label>
          <textarea
            id="description"
            name="description"
            rows={3}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            placeholder="Project details..."
          />
        </div>

        {/* Type */}
        <div>
          <label htmlFor="project_type" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Type
          </label>
          <select
            id="project_type"
            name="project_type"
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            <option value="confirmed">Confirmed (invoiced)</option>
            <option value="upcoming">Upcoming (proforma)</option>
          </select>
        </div>

        {/* Client info */}
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="client_name" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Client name
            </label>
            <input
              type="text"
              id="client_name"
              name="client_name"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
          <div>
            <label htmlFor="client_email" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Client email
            </label>
            <input
              type="email"
              id="client_email"
              name="client_email"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Production details */}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label htmlFor="material" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Material
            </label>
            <select
              id="material"
              name="material"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            >
              <option value="">Select...</option>
              {MATERIALS.map((m) => (
                <option key={m} value={m}>{m}</option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="assigned_printer" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Printer
            </label>
            <input
              type="text"
              id="assigned_printer"
              name="assigned_printer"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
              placeholder="e.g. X1C #1"
            />
          </div>
          <div>
            <label htmlFor="print_time_minutes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
              Print time (min)
            </label>
            <input
              type="number"
              id="print_time_minutes"
              name="print_time_minutes"
              min="0"
              className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
          </div>
        </div>

        {/* Price */}
        <div className="max-w-xs">
          <label htmlFor="price" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Price
          </label>
          <div className="relative mt-1">
            <input
              type="number"
              id="price"
              name="price"
              step="0.01"
              min="0"
              className="block w-full rounded-lg border border-zinc-300 bg-white py-2 pr-3 pl-7 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
            />
            <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-sm text-zinc-400">
              &euro;
            </span>
          </div>
        </div>

        {/* Notes */}
        <div>
          <label htmlFor="notes" className="block text-sm font-medium text-zinc-700 dark:text-zinc-300">
            Internal notes
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            className="mt-1 block w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
        </div>

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 border-t border-zinc-200 pt-4 dark:border-zinc-700">
          <Link
            href="/dashboard"
            className="rounded-lg border border-zinc-300 px-4 py-2 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            Cancel
          </Link>
          <button
            type="submit"
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 focus:ring-2 focus:ring-green-500 focus:ring-offset-2 focus:outline-none dark:focus:ring-offset-zinc-900"
          >
            Create project
          </button>
        </div>
      </form>
    </div>
  );
}
