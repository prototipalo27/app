"use client";

import { useEffect, useState } from "react";
import {
  subscribeToPush,
  unsubscribeFromPush,
  isPushSubscribed,
} from "@/lib/push-notifications/client";

export default function NotificationBell() {
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    isPushSubscribed().then((val) => {
      setSubscribed(val);
      setLoading(false);
    });
  }, []);

  async function toggle() {
    setLoading(true);
    if (subscribed) {
      await unsubscribeFromPush();
      setSubscribed(false);
    } else {
      const ok = await subscribeToPush();
      setSubscribed(ok);
    }
    setLoading(false);
  }

  // Don't render on server or if push not supported
  if (typeof window !== "undefined" && !("PushManager" in window)) {
    return null;
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      title={subscribed ? "Desactivar notificaciones" : "Activar notificaciones"}
      className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium text-zinc-700 hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800 disabled:opacity-50"
    >
      {subscribed ? (
        <svg className="h-4 w-4 text-green-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C10.9 2 10 2.9 10 4c0 .3.1.6.2.9C7.3 5.8 5.5 8.2 5.5 11v5l-2 2v1h17v-1l-2-2v-5c0-2.8-1.8-5.2-4.7-6.1.1-.3.2-.6.2-.9 0-1.1-.9-2-2-2zm0 20c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z" />
        </svg>
      ) : (
        <svg className="h-4 w-4 text-red-500" fill="currentColor" viewBox="0 0 24 24">
          <path d="M12 2C10.9 2 10 2.9 10 4c0 .3.1.6.2.9C7.3 5.8 5.5 8.2 5.5 11v5l-2 2v1h17v-1l-2-2v-5c0-2.8-1.8-5.2-4.7-6.1.1-.3.2-.6.2-.9 0-1.1-.9-2-2-2zm0 20c1.1 0 2-.9 2-2h-4c0 1.1.9 2 2 2z" />
        </svg>
      )}
      {subscribed ? "on" : "off"}
    </button>
  );
}
