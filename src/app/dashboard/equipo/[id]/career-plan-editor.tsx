"use client";

import { useState, useTransition } from "react";
import { updateEmployeeProfile } from "./actions";

type Props = {
  userId: string;
  careerPlan: string | null;
  isManager: boolean;
};

export default function CareerPlanEditor({ userId, careerPlan, isManager }: Props) {
  const [isPending, startTransition] = useTransition();
  const [text, setText] = useState(careerPlan ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateEmployeeProfile(userId, {
        career_plan: text || null,
      });
      if (result.success) {
        setMessage({ type: "success", text: "Guardado" });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: "error", text: result.error ?? "Error" });
      }
    });
  }

  if (!isManager) {
    return (
      <div className="whitespace-pre-wrap text-sm text-zinc-700 dark:text-zinc-300">
        {careerPlan || <span className="text-zinc-400">Sin plan de carrera definido</span>}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={6}
        placeholder="Describe el plan de carrera del empleado..."
        className="w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-green-500"
      />
      <div className="flex items-center gap-2">
        <button
          onClick={handleSave}
          disabled={isPending}
          className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
        >
          {isPending ? "Guardando..." : "Guardar"}
        </button>
        {message && (
          <span
            className={`text-sm ${message.type === "success" ? "text-green-600" : "text-red-500"}`}
          >
            {message.text}
          </span>
        )}
      </div>
    </div>
  );
}
