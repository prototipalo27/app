"use client";

import { closePurchaseList, reopenPurchaseList } from "../actions";

export default function ListStatusToggle({
  listId,
  status,
}: {
  listId: string;
  status: string;
}) {
  async function handleToggle() {
    if (status === "open") {
      await closePurchaseList(listId);
    } else {
      await reopenPurchaseList(listId);
    }
  }

  return (
    <button
      type="button"
      onClick={handleToggle}
      className="rounded-lg border border-zinc-300 px-3 py-1.5 text-xs font-medium text-zinc-700 hover:bg-zinc-50 dark:border-zinc-700 dark:text-zinc-300 dark:hover:bg-zinc-800"
    >
      {status === "open" ? "Cerrar lista" : "Reabrir lista"}
    </button>
  );
}
