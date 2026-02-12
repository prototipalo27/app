"use client";

import { useActionState, useTransition } from "react";
import { updateUserRole, toggleUserActive, inviteUser } from "./actions";
import type { UserRole } from "@/lib/rbac";

type UserProfile = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "Empleado" },
  { value: "manager", label: "Manager" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin:
    "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager:
    "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  employee:
    "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

export default function UsersTable({
  users,
  currentUserId,
}: {
  users: UserProfile[];
  currentUserId: string;
}) {
  const [inviteState, inviteAction, invitePending] = useActionState(
    inviteUser,
    null
  );

  return (
    <div className="space-y-6">
      {/* Invite form */}
      <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900">
        <h2 className="mb-3 text-sm font-semibold text-zinc-900 dark:text-white">
          Invitar usuario
        </h2>
        <form action={inviteAction} className="flex gap-2">
          <input
            name="email"
            type="email"
            required
            placeholder="nombre@prototipalo.com"
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={invitePending}
            className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-50"
          >
            {invitePending ? "Enviando..." : "Invitar"}
          </button>
        </form>
        {inviteState?.error && (
          <p className="mt-2 text-sm text-red-600 dark:text-red-400">
            {inviteState.error}
          </p>
        )}
        {inviteState?.message && (
          <p className="mt-2 text-sm text-green-600 dark:text-green-400">
            {inviteState.message}
          </p>
        )}
      </div>

      {/* Users list */}
      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b border-zinc-200 dark:border-zinc-800">
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Email
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Rol
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Estado
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Acciones
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => (
                <UserRow
                  key={user.id}
                  user={user}
                  isSelf={user.id === currentUserId}
                />
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function UserRow({
  user,
  isSelf,
}: {
  user: UserProfile;
  isSelf: boolean;
}) {
  const [rolePending, startRoleTransition] = useTransition();
  const [activePending, startActiveTransition] = useTransition();

  const isProtected = user.email === "manu@prototipalo.com";
  const disabled = isSelf || isProtected;

  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      <td className="px-4 py-3 text-zinc-900 dark:text-white">
        {user.email}
        {isSelf && (
          <span className="ml-2 text-xs text-zinc-400">(tu)</span>
        )}
      </td>
      <td className="px-4 py-3">
        {disabled ? (
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}
          >
            {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ??
              user.role}
          </span>
        ) : (
          <select
            value={user.role}
            disabled={rolePending}
            onChange={(e) => {
              startRoleTransition(async () => {
                await updateUserRole(user.id, e.target.value as UserRole);
              });
            }}
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-green-500 focus:ring-1 focus:ring-green-500 focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </td>
      <td className="px-4 py-3">
        <span
          className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
            user.is_active
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
          }`}
        >
          {user.is_active ? "Activo" : "Desactivado"}
        </span>
      </td>
      <td className="px-4 py-3">
        {!disabled && (
          <button
            disabled={activePending}
            onClick={() => {
              startActiveTransition(async () => {
                await toggleUserActive(user.id, !user.is_active);
              });
            }}
            className={`rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ${
              user.is_active
                ? "bg-red-100 text-red-700 hover:bg-red-200 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
                : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
            }`}
          >
            {activePending
              ? "..."
              : user.is_active
                ? "Desactivar"
                : "Activar"}
          </button>
        )}
      </td>
    </tr>
  );
}
