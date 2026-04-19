"use server";

import { requireRole } from "@/lib/rbac";
import { getOrCreateMonthFolder } from "@/app/dashboard/finanzas/extracto/actions";

export async function getMonthFolderId(month: number, year: number) {
  await requireRole("manager");
  return getOrCreateMonthFolder(month, year);
}
