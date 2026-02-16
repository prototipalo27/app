"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";

export default function SessionRefresh() {
  useEffect(() => {
    const supabase = createClient();

    // Refresh session when app comes back to foreground (iOS PWA fix)
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        supabase.auth.getSession().then(({ data: { session } }) => {
          if (session) {
            // Token is still valid, just refresh it proactively
            supabase.auth.refreshSession();
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);

    // Also refresh on focus (catches iOS PWA resume from background)
    const handleFocus = () => {
      supabase.auth.refreshSession();
    };
    window.addEventListener("focus", handleFocus);

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return null;
}
