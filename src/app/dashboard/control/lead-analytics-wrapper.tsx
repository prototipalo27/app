"use client";

import dynamic from "next/dynamic";

const LeadAnalytics = dynamic(
  () => import("./lead-analytics").then((m) => m.LeadAnalytics),
  {
    ssr: false,
    loading: () => (
      <div className="h-64 animate-pulse rounded-xl bg-zinc-100 dark:bg-zinc-900" />
    ),
  }
);

export { LeadAnalytics };
