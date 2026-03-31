"use client";

import dynamic from "next/dynamic";

const CrmKanban = dynamic(
  () => import("./crm-kanban").then((m) => m.CrmKanban),
  { ssr: false },
);

export { CrmKanban };
