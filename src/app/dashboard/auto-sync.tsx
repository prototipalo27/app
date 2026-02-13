"use client";

import { useEffect, useRef } from "react";
import { triggerHoldedSync } from "./projects/actions";

/**
 * Auto-syncs Holded when the dashboard loads, if the last sync
 * was more than 15 minutes ago. Runs silently in the background.
 */
export function AutoSync({ lastSyncAt }: { lastSyncAt: string | null }) {
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;

    const FIFTEEN_MIN = 15 * 60 * 1000;
    const lastSync = lastSyncAt ? new Date(lastSyncAt).getTime() : 0;
    const stale = Date.now() - lastSync > FIFTEEN_MIN;

    if (!stale) return;

    ran.current = true;
    triggerHoldedSync().catch(() => {});
  }, [lastSyncAt]);

  return null;
}
