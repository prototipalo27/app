"use client";

import { useState, useTransition } from "react";
import { updateEmployeeProfile } from "./actions";

type Props = {
  employee: {
    id: string;
    full_name: string | null;
    nickname: string | null;
    birthday: string | null;
    phone: string | null;
    hire_date: string | null;
  };
  isManager: boolean;
};

export default function EmployeeProfileForm({ employee, isManager }: Props) {
  const [isPending, startTransition] = useTransition();
  const [fullName, setFullName] = useState(employee.full_name ?? "");
  const [nickname, setNickname] = useState(employee.nickname ?? "");
  const [birthday, setBirthday] = useState(employee.birthday ?? "");
  const [phone, setPhone] = useState(employee.phone ?? "");
  const [hireDate, setHireDate] = useState(employee.hire_date ?? "");
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  function handleSave() {
    setMessage(null);
    startTransition(async () => {
      const result = await updateEmployeeProfile(employee.id, {
        full_name: fullName || undefined,
        nickname: nickname || null,
        birthday: birthday || null,
        phone: phone || null,
        hire_date: hireDate || null,
      });
      if (result.success) {
        setMessage({ type: "success", text: "Guardado" });
        setTimeout(() => setMessage(null), 2000);
      } else {
        setMessage({ type: "error", text: result.error ?? "Error" });
      }
    });
  }

  const inputClass =
    "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-100 dark:placeholder-zinc-500 dark:focus:border-green-500";
  const readOnlyClass =
    "w-full rounded-lg border border-zinc-100 bg-zinc-50 px-3 py-2 text-sm text-zinc-700 dark:border-zinc-800 dark:bg-zinc-800/50 dark:text-zinc-300";

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Nombre completo
        </label>
        {isManager ? (
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className={inputClass}
            placeholder="Nombre completo"
          />
        ) : (
          <div className={readOnlyClass}>{fullName || "—"}</div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Mote
        </label>
        {isManager ? (
          <input
            type="text"
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            className={inputClass}
            placeholder="Ej: Meri, Javi..."
          />
        ) : (
          <div className={readOnlyClass}>{nickname || "—"}</div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Telefono
        </label>
        {isManager ? (
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className={inputClass}
            placeholder="+34 600 000 000"
          />
        ) : (
          <div className={readOnlyClass}>{phone || "—"}</div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Fecha de nacimiento
        </label>
        {isManager ? (
          <input
            type="date"
            value={birthday}
            onChange={(e) => setBirthday(e.target.value)}
            className={inputClass}
          />
        ) : (
          <div className={readOnlyClass}>
            {birthday
              ? new Date(birthday + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </div>
        )}
      </div>

      <div>
        <label className="mb-1 block text-xs font-medium text-zinc-500 dark:text-zinc-400">
          Fecha de incorporacion
        </label>
        {isManager ? (
          <input
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            className={inputClass}
          />
        ) : (
          <div className={readOnlyClass}>
            {hireDate
              ? new Date(hireDate + "T00:00:00").toLocaleDateString("es-ES", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "—"}
          </div>
        )}
      </div>

      {isManager && (
        <div className="flex items-end gap-2 sm:col-span-2">
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
      )}
    </div>
  );
}
