"use client";

import { useState, useActionState, useTransition } from "react";
import {
  inviteUser,
  updateUserRole,
  toggleUserActive,
  deleteUser,
  updateContractEndDate,
} from "../users/actions";
import type { UserRole } from "@/lib/rbac";

type UserProfile = {
  id: string;
  email: string;
  role: string;
  is_active: boolean;
  full_name: string | null;
  contract_end_date: string | null;
};

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: "employee", label: "Empleado" },
  { value: "manager", label: "Manager" },
  { value: "super_admin", label: "Super Admin" },
];

const ROLE_COLORS: Record<string, string> = {
  super_admin: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-400",
  manager: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
  employee: "bg-zinc-100 text-zinc-700 dark:bg-zinc-800 dark:text-zinc-400",
};

function contractBadge(dateStr: string | null): { label: string; className: string } | null {
  if (!dateStr) return null;
  const end = new Date(dateStr);
  const now = new Date();
  const daysLeft = Math.ceil((end.getTime() - now.getTime()) / 86400000);
  if (daysLeft < 0) return { label: "Vencido", className: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400" };
  if (daysLeft <= 30) return { label: `${daysLeft}d`, className: "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400" };
  if (daysLeft <= 90) return { label: `${daysLeft}d`, className: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400" };
  return { label: `${daysLeft}d`, className: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" };
}

export default function AdminSection({
  users: initialUsers,
  currentUserId,
}: {
  users: UserProfile[];
  currentUserId: string;
}) {
  const [users, setUsers] = useState(initialUsers);
  const [expanded, setExpanded] = useState(false);
  const [inviteState, inviteAction, invitePending] = useActionState(inviteUser, null);

  return (
    <div className="rounded-xl border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900">
      <button
        type="button"
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center justify-between px-5 py-4"
      >
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Gestion de empleados</h2>
          <span className="rounded-full bg-zinc-200 px-2 py-0.5 text-xs font-medium text-zinc-700 dark:bg-zinc-700 dark:text-zinc-300">
            {users.length}
          </span>
          {/* Alert: contracts expiring soon */}
          {(() => {
            const expiring = users.filter((u) => {
              const b = contractBadge(u.contract_end_date);
              return b && (b.label === "Vencido" || parseInt(b.label) <= 30);
            });
            if (expiring.length === 0) return null;
            return (
              <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/30 dark:text-red-400">
                {expiring.length} contrato{expiring.length > 1 ? "s" : ""} por vencer
              </span>
            );
          })()}
        </div>
        <svg className={`h-4 w-4 text-zinc-400 transition-transform ${expanded ? "rotate-180" : ""}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-zinc-200 dark:border-zinc-800">
          {/* Invite form */}
          <div className="border-b border-zinc-100 px-5 py-3 dark:border-zinc-800">
            <form action={inviteAction} className="flex gap-2">
              <input
                name="email"
                type="email"
                required
                placeholder="nombre@prototipalo.com"
                className="flex-1 rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm placeholder-zinc-400 focus:border-brand-blue focus:ring-1 focus:ring-brand-blue focus:outline-none dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
              />
              <button
                type="submit"
                disabled={invitePending}
                className="rounded-lg bg-brand px-4 py-1.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-50"
              >
                {invitePending ? "..." : "Invitar"}
              </button>
            </form>
            {inviteState?.error && <p className="mt-1.5 text-xs text-red-600">{inviteState.error}</p>}
            {inviteState?.message && <p className="mt-1.5 text-xs text-green-600">{inviteState.message}</p>}
          </div>

          {/* User rows */}
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {users.map((user) => (
              <AdminUserRow
                key={user.id}
                user={user}
                isSelf={user.id === currentUserId}
                onDeleted={() => setUsers((prev) => prev.filter((u) => u.id !== user.id))}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminUserRow({
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

  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3">
      {/* Name + email */}
      <div className="min-w-0 basis-48">
        <p className="truncate text-sm font-medium text-zinc-900 dark:text-white">
          {user.full_name || user.email.split("@")[0]}
          {isSelf && <span className="ml-1 text-xs text-zinc-400">(tu)</span>}
        </p>
        <p className="truncate text-xs text-zinc-500">{user.email}</p>
      </div>

      {/* Role */}
      <div className="shrink-0">
        {disabled ? (
          <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_COLORS[user.role] || ROLE_COLORS.employee}`}>
            {ROLE_OPTIONS.find((r) => r.value === user.role)?.label ?? user.role}
          </span>
        ) : (
          <select
            value={user.role}
            disabled={rolePending}
            onChange={(e) => startRoleTransition(async () => { await updateUserRole(user.id, e.target.value as UserRole); })}
            className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs disabled:opacity-50 dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
          >
            {ROLE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        )}
      </div>

      {/* Contract end */}
      <div className="shrink-0">
        {editingContract ? (
          <div className="flex items-center gap-1">
            <input
              type="date"
              value={contractDate}
              onChange={(e) => setContractDate(e.target.value)}
              className="h-7 rounded-md border border-zinc-300 bg-white px-2 text-xs dark:border-zinc-700 dark:bg-zinc-800 dark:text-white"
            />
            <button
              onClick={async () => {
                setSavingContract(true);
                await updateContractEndDate(user.id, contractDate || null);
                user.contract_end_date = contractDate || null;
                setSavingContract(false);
                setEditingContract(false);
              }}
              disabled={savingContract}
              className="rounded px-1.5 py-0.5 text-xs font-medium bg-brand text-white hover:bg-brand-dark disabled:opacity-50"
            >
              {savingContract ? "..." : "OK"}
            </button>
            <button onClick={() => { setEditingContract(false); setContractDate(user.contract_end_date || ""); }} className="text-xs text-zinc-400 hover:text-zinc-600">X</button>
          </div>
        ) : (
          <button onClick={() => setEditingContract(true)} className="flex items-center gap-1 text-xs">
            {user.contract_end_date ? (
              <>
                <span className="text-zinc-600 dark:text-zinc-300">
                  {new Date(user.contract_end_date).toLocaleDateString("es-ES", { day: "numeric", month: "short", year: "2-digit" })}
                </span>
                {badge && <span className={`rounded px-1 py-0.5 text-[10px] font-medium ${badge.className}`}>{badge.label}</span>}
              </>
            ) : (
              <span className="text-zinc-400 hover:text-zinc-600">+ Contrato</span>
            )}
          </button>
        )}
      </div>

      {/* Status badge */}
      <span className={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${user.is_active ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400" : "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"}`}>
        {user.is_active ? "Activo" : "Inactivo"}
      </span>

      {/* Actions */}
      {!disabled && (
        <div className="ml-auto flex items-center gap-1.5">
          <button
            disabled={activePending}
            onClick={() => startActiveTransition(async () => { await toggleUserActive(user.id, !user.is_active); })}
            className={`rounded px-2 py-1 text-xs font-medium disabled:opacity-50 ${user.is_active ? "text-amber-700 hover:bg-amber-100 dark:text-amber-400" : "text-green-700 hover:bg-green-100 dark:text-green-400"}`}
          >
            {activePending ? "..." : user.is_active ? "Desactivar" : "Activar"}
          </button>
          <button
            disabled={deleting}
            onClick={async () => {
              if (!confirm(`Eliminar definitivamente a ${user.email}?`)) return;
              setDeleting(true);
              const r = await deleteUser(user.id);
              if (r.success) onDeleted();
              else alert(r.error);
              setDeleting(false);
            }}
            className="rounded px-2 py-1 text-xs font-medium text-red-600 hover:bg-red-100 disabled:opacity-50 dark:text-red-400"
          >
            {deleting ? "..." : "Eliminar"}
          </button>
        </div>
      )}
    </div>
  );
}
