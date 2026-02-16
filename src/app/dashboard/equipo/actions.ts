"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";

export async function addSkillToUser(userId: string, skillId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_skills")
    .insert({ user_id: userId, skill_id: skillId });

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/equipo");
}

export async function removeSkillFromUser(userId: string, skillId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_skills")
    .delete()
    .eq("user_id", userId)
    .eq("skill_id", skillId);

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/equipo");
}

export async function createSkill(name: string) {
  await requireRole("manager");
  const supabase = await createClient();

  const trimmed = name.trim();
  if (!trimmed) throw new Error("El nombre del skill no puede estar vacío");

  const { data, error } = await supabase
    .from("skills")
    .insert({ name: trimmed })
    .select()
    .single();

  if (error) throw new Error(error.message);
  revalidatePath("/dashboard/equipo");
  return data;
}
