"use client";

import { useState, useRef, useTransition } from "react";
import { addItem, updateItemCompleted, deleteItem } from "../items-actions";
import type { Tables } from "@/lib/supabase/database.types";

interface ProjectItemsProps {
  projectId: string;
  items: Tables<"project_items">[];
}

function ItemRow({
  item,
  isPending,
  onUpdate,
  onDelete,
}: {
  item: Tables<"project_items">;
  isPending: boolean;
  onUpdate: (id: string, completed: number) => void;
  onDelete: (id: string) => void;
}) {
  const [local, setLocal] = useState(item.completed);
  const dragging = useRef(false);
  const prevServer = useRef(item.completed);
  const isComplete = local === item.quantity;
  const pct = item.quantity > 0 ? (local / item.quantity) * 100 : 0;

  // Sync with server value only when it actually changes from the server
  if (item.completed !== prevServer.current) {
    prevServer.current = item.completed;
    if (!dragging.current) {
      setLocal(item.completed);
    }
  }

  function commit(value: number) {
    const clamped = Math.max(0, Math.min(value, item.quantity));
    dragging.current = false;
    setLocal(clamped);
    onUpdate(item.id, clamped);
  }

  return (
    <div className="rounded-lg border border-zinc-100 bg-zinc-50/50 p-3 dark:border-zinc-800 dark:bg-zinc-800/50">
      {/* Top row: check + name + count + delete */}
      <div className="flex items-center gap-2">
        {isComplete ? (
          <span className="text-green-500">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          </span>
        ) : (
          <span className="h-4 w-4" />
        )}
        <span className={`flex-1 text-sm font-medium ${isComplete ? "text-green-600 dark:text-green-400" : "text-zinc-900 dark:text-white"}`}>
          {item.name}
        </span>
        <span className={`text-sm tabular-nums ${isComplete ? "font-semibold text-green-600 dark:text-green-400" : "text-zinc-500 dark:text-zinc-400"}`}>
          {local}/{item.quantity}
        </span>
        <button
          type="button"
          onClick={() => onDelete(item.id)}
          disabled={isPending}
          className="ml-1 rounded-md p-1 text-zinc-400 hover:bg-red-50 hover:text-red-500 disabled:opacity-30 dark:hover:bg-red-900/20 dark:hover:text-red-400"
          title="Delete item"
        >
          <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* Slider + buttons row */}
      <div className="mt-2.5 flex items-center gap-2.5">
        <button
          type="button"
          onClick={() => commit(local - 1)}
          disabled={isPending || local === 0}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-bold text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:active:bg-zinc-500"
        >
          −
        </button>

        <input
          type="range"
          min={0}
          max={item.quantity}
          value={local}
          onChange={(e) => { dragging.current = true; setLocal(Number(e.target.value)); }}
          onMouseUp={() => commit(local)}
          onTouchEnd={() => commit(local)}
          onKeyUp={(e) => { if (e.key === "ArrowLeft" || e.key === "ArrowRight") commit(local); }}
          disabled={isPending}
          className="item-slider h-3 flex-1 cursor-pointer appearance-none rounded-full disabled:opacity-30"
          style={{
            background: `linear-gradient(to right, ${isComplete ? "#22c55e" : "#3b82f6"} ${pct}%, var(--slider-track) ${pct}%)`,
          }}
        />

        <button
          type="button"
          onClick={() => commit(local + 1)}
          disabled={isPending || isComplete}
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-zinc-300 bg-white text-base font-bold text-zinc-600 hover:bg-zinc-50 active:bg-zinc-100 disabled:opacity-30 dark:border-zinc-600 dark:bg-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-600 dark:active:bg-zinc-500"
        >
          +
        </button>
      </div>
    </div>
  );
}

export function ProjectItems({ projectId, items }: ProjectItemsProps) {
  const [isPending, startTransition] = useTransition();

  function handleAdd(formData: FormData) {
    const name = (formData.get("name") as string)?.trim();
    const qty = parseInt(formData.get("quantity") as string, 10) || 1;
    if (!name) return;
    startTransition(async () => {
      await addItem(projectId, name, qty);
    });
  }

  function handleUpdate(itemId: string, completed: number) {
    startTransition(async () => {
      await updateItemCompleted(itemId, completed);
    });
  }

  function handleDelete(itemId: string) {
    startTransition(async () => {
      await deleteItem(itemId);
    });
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-5 dark:border-zinc-800 dark:bg-zinc-900">
      <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
        Items
      </h2>

      {/* Add form */}
      <form action={handleAdd} className="mb-4 flex gap-2">
        <input
          type="text"
          name="name"
          placeholder="Item name"
          required
          className="min-w-0 flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder:text-zinc-500"
        />
        <input
          type="number"
          name="quantity"
          min={1}
          defaultValue={1}
          className="w-18 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
        />
        <button
          type="submit"
          disabled={isPending}
          className="shrink-0 rounded-lg bg-green-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          Add
        </button>
      </form>

      {/* Item list */}
      {items.length === 0 ? (
        <p className="text-sm text-zinc-400 dark:text-zinc-500">No items yet.</p>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <ItemRow
              key={item.id}
              item={item}
              isPending={isPending}
              onUpdate={handleUpdate}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}
    </div>
  );
}
