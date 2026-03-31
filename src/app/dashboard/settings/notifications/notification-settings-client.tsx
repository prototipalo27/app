"use client";

import { useState, useTransition } from "react";
import { updateEventConfig, toggleNotificationPreference } from "./actions";
import type { UserRole } from "@/lib/rbac";

const ALL_ROLES: { value: UserRole; label: string }[] = [
  { value: "super_admin", label: "Admin" },
  { value: "manager", label: "Manager" },
  { value: "comercial", label: "Comercial" },
  { value: "employee", label: "Empleado" },
];

type EventConfig = {
  event_type: string;
  label: string;
  description: string | null;
  category: string;
  target_roles: string[];
  target_user_ids: string[];
  enabled: boolean;
};

type UserPref = {
  event_type: string;
  push_enabled: boolean;
};

type UserInfo = {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
};

export default function NotificationSettingsClient({
  events,
  preferences,
  users,
  currentUserRole,
  isManager,
}: {
  events: EventConfig[];
  preferences: UserPref[];
  users: UserInfo[];
  currentUserRole: string;
  isManager: boolean;
}) {
  const [tab, setTab] = useState<"personal" | "admin">(
    isManager ? "admin" : "personal"
  );

  // Group events by category
  const categories = events.reduce(
    (acc, e) => {
      if (!acc[e.category]) acc[e.category] = [];
      acc[e.category].push(e);
      return acc;
    },
    {} as Record<string, EventConfig[]>
  );

  return (
    <div>
      {isManager && (
        <div className="mb-6 flex gap-1 rounded-lg bg-zinc-100 p-1 dark:bg-zinc-900">
          <button
            onClick={() => setTab("admin")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "admin"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Configuración de eventos
          </button>
          <button
            onClick={() => setTab("personal")}
            className={`flex-1 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
              tab === "personal"
                ? "bg-white text-zinc-900 shadow-sm dark:bg-zinc-800 dark:text-white"
                : "text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            }`}
          >
            Mis preferencias
          </button>
        </div>
      )}

      {tab === "admin" && isManager ? (
        <AdminConfig
          categories={categories}
          users={users}
        />
      ) : (
        <PersonalPreferences
          categories={categories}
          preferences={preferences}
          currentUserRole={currentUserRole}
        />
      )}
    </div>
  );
}

// ─── Admin: configure who receives each event ─────────────────────
function AdminConfig({
  categories,
  users,
}: {
  categories: Record<string, EventConfig[]>;
  users: UserInfo[];
}) {
  const [isPending, startTransition] = useTransition();
  const [localEvents, setLocalEvents] = useState(categories);

  function handleToggleEnabled(eventType: string, enabled: boolean) {
    // Optimistic update
    setLocalEvents((prev) => {
      const next = { ...prev };
      for (const cat of Object.keys(next)) {
        next[cat] = next[cat].map((e) =>
          e.event_type === eventType ? { ...e, enabled } : e
        );
      }
      return next;
    });

    startTransition(async () => {
      await updateEventConfig(eventType, { enabled });
    });
  }

  function handleToggleRole(
    eventType: string,
    role: string,
    currentRoles: string[]
  ) {
    const newRoles = currentRoles.includes(role)
      ? currentRoles.filter((r) => r !== role)
      : [...currentRoles, role];

    // Optimistic update
    setLocalEvents((prev) => {
      const next = { ...prev };
      for (const cat of Object.keys(next)) {
        next[cat] = next[cat].map((e) =>
          e.event_type === eventType ? { ...e, target_roles: newRoles } : e
        );
      }
      return next;
    });

    startTransition(async () => {
      await updateEventConfig(eventType, { target_roles: newRoles });
    });
  }

  function handleToggleUser(
    eventType: string,
    userId: string,
    currentUserIds: string[]
  ) {
    const newIds = currentUserIds.includes(userId)
      ? currentUserIds.filter((id) => id !== userId)
      : [...currentUserIds, userId];

    setLocalEvents((prev) => {
      const next = { ...prev };
      for (const cat of Object.keys(next)) {
        next[cat] = next[cat].map((e) =>
          e.event_type === eventType
            ? { ...e, target_user_ids: newIds }
            : e
        );
      }
      return next;
    });

    startTransition(async () => {
      await updateEventConfig(eventType, { target_user_ids: newIds });
    });
  }

  return (
    <div className="space-y-8">
      {Object.entries(localEvents).map(([category, events]) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {category}
          </h2>
          <div className="space-y-3">
            {events.map((event) => (
              <EventConfigCard
                key={event.event_type}
                event={event}
                users={users}
                isPending={isPending}
                onToggleEnabled={handleToggleEnabled}
                onToggleRole={handleToggleRole}
                onToggleUser={handleToggleUser}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EventConfigCard({
  event,
  users,
  isPending,
  onToggleEnabled,
  onToggleRole,
  onToggleUser,
}: {
  event: EventConfig;
  users: UserInfo[];
  isPending: boolean;
  onToggleEnabled: (eventType: string, enabled: boolean) => void;
  onToggleRole: (eventType: string, role: string, currentRoles: string[]) => void;
  onToggleUser: (eventType: string, userId: string, currentUserIds: string[]) => void;
}) {
  const [showUsers, setShowUsers] = useState(false);

  return (
    <div
      className={`rounded-lg border p-4 transition-opacity ${
        event.enabled
          ? "border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
          : "border-zinc-200/50 bg-zinc-50 opacity-60 dark:border-zinc-800/50 dark:bg-zinc-950"
      } ${isPending ? "pointer-events-none" : ""}`}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="font-medium text-zinc-900 dark:text-white">
              {event.label}
            </h3>
          </div>
          {event.description && (
            <p className="mt-0.5 text-sm text-zinc-500 dark:text-zinc-400">
              {event.description}
            </p>
          )}
        </div>
        <button
          onClick={() => onToggleEnabled(event.event_type, !event.enabled)}
          className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            event.enabled ? "bg-green-500" : "bg-zinc-300 dark:bg-zinc-700"
          }`}
        >
          <span
            className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
              event.enabled ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      {event.enabled && (
        <div className="mt-3 space-y-3">
          {/* Role toggles */}
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-500 dark:text-zinc-400">
              Roles que reciben esta notificación
            </p>
            <div className="flex flex-wrap gap-2">
              {ALL_ROLES.map((role) => {
                const active = event.target_roles.includes(role.value);
                return (
                  <button
                    key={role.value}
                    onClick={() =>
                      onToggleRole(
                        event.event_type,
                        role.value,
                        event.target_roles
                      )
                    }
                    className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                    }`}
                  >
                    {role.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Extra users */}
          <div>
            <button
              onClick={() => setShowUsers(!showUsers)}
              className="flex items-center gap-1 text-xs font-medium text-zinc-500 hover:text-zinc-700 dark:text-zinc-400 dark:hover:text-zinc-300"
            >
              <svg
                className={`h-3 w-3 transition-transform ${showUsers ? "rotate-90" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
              Usuarios adicionales
              {event.target_user_ids.length > 0 && (
                <span className="rounded-full bg-blue-100 px-1.5 text-[10px] text-blue-700 dark:bg-blue-900/30 dark:text-blue-400">
                  {event.target_user_ids.length}
                </span>
              )}
            </button>

            {showUsers && (
              <div className="mt-2 flex flex-wrap gap-2">
                {users.map((user) => {
                  const active = event.target_user_ids.includes(user.id);
                  return (
                    <button
                      key={user.id}
                      onClick={() =>
                        onToggleUser(
                          event.event_type,
                          user.id,
                          event.target_user_ids
                        )
                      }
                      className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                        active
                          ? "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400"
                          : "bg-zinc-100 text-zinc-500 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-400 dark:hover:bg-zinc-700"
                      }`}
                    >
                      {user.full_name || user.email.split("@")[0]}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Personal: toggle my preferences ──────────────────────────────
function PersonalPreferences({
  categories,
  preferences,
  currentUserRole,
}: {
  categories: Record<string, EventConfig[]>;
  preferences: UserPref[];
  currentUserRole: string;
}) {
  const [isPending, startTransition] = useTransition();
  const [localPrefs, setLocalPrefs] = useState<Record<string, boolean>>(() => {
    const map: Record<string, boolean> = {};
    for (const p of preferences) {
      map[p.event_type] = p.push_enabled;
    }
    return map;
  });

  function handleToggle(eventType: string) {
    const currentValue = localPrefs[eventType] ?? true;
    const newValue = !currentValue;

    setLocalPrefs((prev) => ({ ...prev, [eventType]: newValue }));

    startTransition(async () => {
      await toggleNotificationPreference(eventType, newValue);
    });
  }

  // Filter events: only show events that target the current user's role
  const filteredCategories: Record<string, EventConfig[]> = {};
  for (const [category, events] of Object.entries(categories)) {
    const filtered = events.filter(
      (e) => e.enabled && e.target_roles.includes(currentUserRole)
    );
    if (filtered.length > 0) {
      filteredCategories[category] = filtered;
    }
  }

  if (Object.keys(filteredCategories).length === 0) {
    return (
      <div className="rounded-lg border border-zinc-200 bg-white p-8 text-center dark:border-zinc-800 dark:bg-zinc-900">
        <p className="text-sm text-zinc-500 dark:text-zinc-400">
          No tienes notificaciones configuradas para tu rol.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-zinc-500 dark:text-zinc-400">
        Activa o desactiva las notificaciones push que quieres recibir. Solo se muestran los eventos habilitados para tu rol.
      </p>

      {Object.entries(filteredCategories).map(([category, events]) => (
        <div key={category}>
          <h2 className="mb-3 text-sm font-semibold uppercase tracking-wider text-zinc-500 dark:text-zinc-400">
            {category}
          </h2>
          <div className="divide-y divide-zinc-200 rounded-lg border border-zinc-200 bg-white dark:divide-zinc-800 dark:border-zinc-800 dark:bg-zinc-900">
            {events.map((event) => {
              const enabled = localPrefs[event.event_type] ?? true;
              return (
                <div
                  key={event.event_type}
                  className={`flex items-center justify-between gap-4 px-4 py-3 ${isPending ? "pointer-events-none opacity-70" : ""}`}
                >
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-zinc-900 dark:text-white">
                      {event.label}
                    </p>
                    {event.description && (
                      <p className="text-xs text-zinc-500 dark:text-zinc-400">
                        {event.description}
                      </p>
                    )}
                  </div>
                  <button
                    onClick={() => handleToggle(event.event_type)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      enabled
                        ? "bg-green-500"
                        : "bg-zinc-300 dark:bg-zinc-700"
                    }`}
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        enabled ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
