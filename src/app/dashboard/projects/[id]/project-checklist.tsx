"use client";

import { useState, useRef } from "react";
import { toggleChecklistItem, uploadNameList } from "../checklist-actions";

type ChecklistItem = {
  id: string;
  name: string;
  item_type: string;
  position: number;
  completed: boolean;
  data: { names?: string[] } | null;
};

export default function ProjectChecklist({
  items,
  templateName,
}: {
  items: ChecklistItem[];
  templateName: string | null;
}) {
  const [localItems, setLocalItems] = useState(items);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadingItemId, setUploadingItemId] = useState<string | null>(null);
  const [expandedItem, setExpandedItem] = useState<string | null>(null);
  const [csvPreview, setCsvPreview] = useState<{ itemId: string; names: string[] } | null>(null);

  const completedCount = localItems.filter((i) => i.completed).length;

  async function handleToggle(itemId: string, completed: boolean) {
    setLocalItems((prev) =>
      prev.map((i) => (i.id === itemId ? { ...i, completed } : i))
    );
    const result = await toggleChecklistItem(itemId, completed);
    if (!result.success) {
      setLocalItems((prev) =>
        prev.map((i) => (i.id === itemId ? { ...i, completed: !completed } : i))
      );
    }
  }

  function handleFileSelect(itemId: string) {
    setUploadingItemId(itemId);
    fileInputRef.current?.click();
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !uploadingItemId) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const names = text
        .split("\n")
        .map((line) => {
          const trimmed = line.trim();
          if (!trimmed) return "";
          // Take first column if there are commas
          return trimmed.includes(",") ? trimmed.split(",")[0].trim() : trimmed;
        })
        .filter(Boolean);

      setCsvPreview({ itemId: uploadingItemId, names });
    };
    reader.readAsText(file);
    e.target.value = "";
  }

  async function confirmUpload() {
    if (!csvPreview) return;
    const result = await uploadNameList(csvPreview.itemId, csvPreview.names);
    if (result.success) {
      setLocalItems((prev) =>
        prev.map((i) =>
          i.id === csvPreview.itemId
            ? { ...i, data: { names: csvPreview.names } }
            : i
        )
      );
    }
    setCsvPreview(null);
    setUploadingItemId(null);
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
        <div className="flex items-center gap-2">
          <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">
            Checklist{templateName ? ` (${templateName})` : ""}
          </h2>
        </div>
        <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
          {completedCount}/{localItems.length}
        </span>
      </div>

      {/* Items */}
      <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
        {localItems.map((item) => {
          const names = (item.data as { names?: string[] })?.names;
          const isExpanded = expandedItem === item.id;

          return (
            <div key={item.id} className="px-5 py-3">
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleToggle(item.id, !item.completed)}
                  className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                    item.completed
                      ? "border-green-500 bg-green-500 text-white"
                      : "border-zinc-300 dark:border-zinc-600"
                  }`}
                >
                  {item.completed && (
                    <svg className="h-3 w-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                </button>
                <span
                  className={`flex-1 text-sm ${
                    item.completed
                      ? "text-zinc-400 line-through dark:text-zinc-500"
                      : "text-zinc-900 dark:text-white"
                  }`}
                >
                  {item.name}
                </span>

                {/* Name list controls */}
                {item.item_type === "name_list" && (
                  <div className="flex items-center gap-2">
                    {names && names.length > 0 && (
                      <button
                        onClick={() =>
                          setExpandedItem(isExpanded ? null : item.id)
                        }
                        className="flex items-center gap-1 rounded-md bg-purple-50 px-2 py-1 text-xs font-medium text-purple-700 hover:bg-purple-100 dark:bg-purple-900/20 dark:text-purple-400 dark:hover:bg-purple-900/30"
                      >
                        {names.length} nombres
                        <svg
                          className={`h-3 w-3 transition-transform ${isExpanded ? "rotate-180" : ""}`}
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                        </svg>
                      </button>
                    )}
                    <button
                      onClick={() => handleFileSelect(item.id)}
                      className="rounded-md border border-zinc-300 px-2 py-1 text-xs font-medium text-zinc-600 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-400 dark:hover:bg-zinc-800"
                    >
                      Subir CSV
                    </button>
                  </div>
                )}
              </div>

              {/* Expanded name list */}
              {item.item_type === "name_list" && isExpanded && names && (
                <div className="mt-2 ml-8 rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
                  <ul className="space-y-1">
                    {names.map((name, idx) => (
                      <li
                        key={idx}
                        className="text-xs text-zinc-700 dark:text-zinc-300"
                      >
                        {idx + 1}. {name}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".csv,.txt"
        className="hidden"
        onChange={handleFileChange}
      />

      {/* CSV confirmation modal */}
      {csvPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="mx-4 w-full max-w-md rounded-xl bg-white p-6 dark:bg-zinc-900">
            <h3 className="mb-2 text-sm font-semibold text-zinc-900 dark:text-white">
              Confirmar nombres
            </h3>
            <p className="mb-3 text-xs text-zinc-500 dark:text-zinc-400">
              Se encontraron {csvPreview.names.length} nombres:
            </p>
            <div className="mb-4 max-h-60 overflow-y-auto rounded-lg bg-zinc-50 p-3 dark:bg-zinc-800">
              <ul className="space-y-1">
                {csvPreview.names.map((name, idx) => (
                  <li
                    key={idx}
                    className="text-xs text-zinc-700 dark:text-zinc-300"
                  >
                    {idx + 1}. {name}
                  </li>
                ))}
              </ul>
            </div>
            <div className="flex justify-end gap-2">
              <button
                onClick={() => {
                  setCsvPreview(null);
                  setUploadingItemId(null);
                }}
                className="rounded-lg border border-zinc-300 px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
              >
                Cancelar
              </button>
              <button
                onClick={confirmUpload}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700"
              >
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
