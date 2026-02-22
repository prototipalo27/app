"use client";

import { useEffect, useRef } from "react";
import { createClient } from "@/lib/supabase/client";

const REFRESH_COOLDOWN_MS = 60_000; // 1 minute minimum between refreshes

export default function SessionRefresh() {
  const lastRefresh = useRef(0);

  useEffect(() => {
    const supabase = createClient();

    const refreshIfNeeded = () => {
      const now = Date.now();
      if (now - lastRefresh.current < REFRESH_COOLDOWN_MS) return;
      lastRefresh.current = now;
      supabase.auth.refreshSession();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        refreshIfNeeded();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, []);

  return null;
}
