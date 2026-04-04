"use client";

import { useState, useActionState, useTransition } from "react";
import { updateUserRole, toggleUserActive, inviteUser, deleteUser, updateContractEndDate } from "./actions";
import type { UserRole } from "@/lib/rbac";

type UserProfile = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  created_at: string | null;
  full_name: string | null;
  contract_end_date: string | null;
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

function contractBadge(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);

  if (daysLeft < 0) {
    return { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  }
  if (daysLeft <= 30) {
    return { label: `${daysLeft}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  }
  if (daysLeft <= 90) {
    return { label: `${daysLeft}d`, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  }
  return { label: `${daysLeft}d`, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

export default function UsersTable({
  users: initialUsers,
  currentUserId,
}: {
  users: UserProfile[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
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
            className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900 placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white dark:placeholder-zinc-500"
          />
          <button
            type="submit"
            disabled={invitePending}
            className="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
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
                  Usuario
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Rol
                </th>
                <th className="px-4 py-3 font-medium text-zinc-500 dark:text-zinc-400">
                  Fin contrato
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
                  onDeleted={() => setUsers((prev) => prev.filter((u) => u.id !== user.id))}
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
  onDeleted,
}: {
  user: UserProfile;
  isSelf: boolean;
  onDeleted: () => void;
}) {
  const [rolePending, startRoleTransition] = useTransition();
  const [activePending, startActiveTransition] = useTransition();
  const [deleting, setDeleting] = useState(false);
  const [editingContract, setEditingContract] = useState(false);
  const [contractDate, setContractDate] = useState(user.contract_end_date || "");
  const [savingContract, setSavingContract] = useState(false);

  const isProtected = user.email === "manu@prototipalo.com";
  const disabled = isSelf || isProtected;

  const badge = contractBadge(user.contract_end_date);

  const handleDelete = async () => {
    if (!confirm(`Eliminar definitivamente a ${user.email}? Se borrara su cuenta y todos sus datos.`)) return;
    setDeleting(true);
    const result = await deleteUser(user.id);
    if (result.success) {
      onDeleted();
    } else {
      alert(result.error || "Error al eliminar");
    }
    setDeleting(false);
  };

  const handleSaveContract = async () => {
    setSavingContract(true);
    await updateContractEndDate(user.id, contractDate || null);
    user.contract_end_date = contractDate || null;
    setSavingContract(false);
    setEditingContract(false);
  };

  return (
    <tr className="border-b border-zinc-100 last:border-0 dark:border-zinc-800">
      {/* User info */}
      <td className="px-4 py-3">
        <div>
          <span className="text-zinc-900 dark:text-white">{user.email}</span>
          {isSelf && (
            <span className="ml-2 text-xs text-zinc-400">(tu)</span>
          )}
        </div>
        {user.full_name && (
          <span className="text-xs text-zinc-500 dark:text-zinc-400">{user.full_name}</span>
        )}
      </td>

      {/* Role */}
      <td className="px-4 py-3">
        {disabled ? (
          <span
            className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}
          >
            {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
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
            className="rounded-lg border border-zinc-300 bg-white px-2 py-1 text-xs text-zinc-900 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {ROLE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        )}
      </td>

      {/* Contract end date */}
      <td className="px-4 py-3">
        {editingContract ? (
          <div className="flex items-center gap-1.5">
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <button
              onClick={handleSaveContract}
              disabled={savingContract}
              className="rounded px-2 py-1 text-xs font-medium bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {savingContract ? "..." : "OK"}
            </button>
            <button
              onClick={() => { setEditingContract(false); setContractDate(user.contract_end_date || ""); }}
              className="rounded px-2 py-1 text-xs text-zinc-500 hover:text-zinc-700"
            >
              X
            </button>
          </div>
        ) : (
          <button
            onClick={() => setEditingContract(true)}
            className="group flex items-center gap-1.5 text-xs"
          >
            {user.contract_end_date ? (
              <>
                <span className="text-zinc-700 dark:text-zinc-300">
                  {new Date(user.contract_end_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "numeric" })}
                </span>
                {badge && (
                  <span className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${badge.className}`}>
                    {badge.label}
                  </span>
                )}
              </>
            ) : (
              <span className="text-zinc-400 group-hover:text-zinc-600 dark:group-hover:text-zinc-300">
                Establecer fecha
              </span>
            )}
          </button>
        )}
      </td>

      {/* Status */}
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

      {/* Actions */}
      <td className="px-4 py-3">
        {!disabled && (
          <div className="flex items-center gap-2">
            <button
              disabled={activePending}
              onClick={() => {
                startActiveTransition(async () => {
                  await toggleUserActive(user.id, !user.is_active);
                });
              }}
              className={`rounded px-3 py-1 text-xs font-medium disabled:opacity-50 ${
                user.is_active
                  ? "bg-amber-100 text-amber-700 hover:bg-amber-200 dark:bg-amber-900/30 dark:text-amber-400 dark:hover:bg-amber-900/50"
                  : "bg-green-100 text-green-700 hover:bg-green-200 dark:bg-green-900/30 dark:text-green-400 dark:hover:bg-green-900/50"
              }`}
            >
              {activePending
                ? "..."
                : user.is_active
                  ? "Desactivar"
                  : "Activar"}
            </button>
            <button
              disabled={deleting}
              onClick={handleDelete}
              className="rounded px-3 py-1 text-xs font-medium bg-red-100 text-red-700 hover:bg-red-200 disabled:opacity-50 dark:bg-red-900/30 dark:text-red-400 dark:hover:bg-red-900/50"
            >
              {deleting ? "..." : "Eliminar"}
            </button>
          </div>
        )}
      </td>
    </tr>
  );
}
