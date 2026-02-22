"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { startImpersonating } from "@/lib/impersonate";

type User = { id: string; email: string; role: string };

const ROLE_LABELS: Record<string, string> = {
  super_admin: "Admin",
  manager: "Manager",
  employee: "Empleado",
};

export default function ImpersonateButton({ users }: { users: User[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
      >
        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
        </svg>
        Ver como...
      </button>

      {open && (
        <div className="absolute bottom-full left-0 z-50 mb-1 w-64 rounded-lg border border-zinc-200 bg-white shadow-lg dark:border-zinc-700 dark:bg-zinc-800">
          <div className="max-h-60 overflow-y-auto p-1">
            {users.map((user) => (
              <button
                key={user.id}
                onClick={async () => {
                  await startImpersonating(user.id);
                  setOpen(false);
                  router.refresh();
                }}
                className="flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"
              >
                <span className="truncate text-zinc-800 dark:text-zinc-200">
                  {user.email}
                </span>
                <span className="ml-2 shrink-0 text-xs text-zinc-500 dark:text-zinc-400">
                  {ROLE_LABELS[user.role] ?? user.role}
                </span>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
