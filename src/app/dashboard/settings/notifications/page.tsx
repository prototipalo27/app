import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import {
  getNotificationEvents,
  getMyNotificationPreferences,
  getActiveUsers,
} from "./actions";
import NotificationSettingsClient from "./notification-settings-client";

export const metadata = {
  title: "Notificaciones - Prototipalo",
};

export default async function NotificationSettingsPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const isManager = hasRole(profile.role, "manager");

  const [eventsResult, prefsResult, usersResult] = await Promise.all([
    getNotificationEvents(),
    getMyNotificationPreferences(),
    isManager ? getActiveUsers() : Promise.resolve({ data: null }),
  ]);

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900 dark:text-white">
          Notificaciones
        </h1>
        <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
          {isManager
            ? "Configura quién recibe cada tipo de notificación y gestiona tus preferencias personales."
            : "Gestiona qué notificaciones quieres recibir."}
        </p>
      </div>

      <NotificationSettingsClient
        events={eventsResult.data ?? []}
        preferences={prefsResult.data ?? []}
        users={usersResult.data ?? []}
        currentUserRole={profile.role}
        isManager={isManager}
      />
    </div>
  );
}
