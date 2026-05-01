"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { madridInputToIso } from "@/lib/dates";

function strOrNull(v: FormDataEntryValue | null): string | null {
  const s = (v as string | null)?.trim();
  return s ? s : null;
}

function parseAttendees(formData: FormData): string[] {
  // Checkboxes (cada uno comparte el name "attendees") + input libre de extras
  const fromCheckboxes = formData
    .getAll("attendees")
    .filter((v): v is string => typeof v === "string" && v.trim().length > 0)
    .map((s) => s.trim());

  const extraRaw = (formData.get("attendees_extra") as string | null) ?? "";
  const fromExtra = extraRaw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const result: string[] = [];
  for (const a of [...fromCheckboxes, ...fromExtra]) {
    if (!seen.has(a)) {
      seen.add(a);
      result.push(a);
    }
  }
  return result;
}

export async function addStudioMeeting(formData: FormData) {
  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) throw new Error("Not authenticated");

  const projectId = strOrNull(formData.get("studio_project_id"));
  const meetingDate = madridInputToIso(strOrNull(formData.get("meeting_date")));
  if (!projectId || !meetingDate) throw new Error("Falta proyecto o fecha");

  const { error } = await supabase.from("studio_meetings").insert({
    studio_project_id: projectId,
    meeting_date: meetingDate,
    attendees: parseAttendees(formData),
    summary: strOrNull(formData.get("summary")),
    action_items: strOrNull(formData.get("action_items")),
    recording_url: strOrNull(formData.get("recording_url")),
    created_by: userData.user.id,
  });

  if (error) {
    console.error("[studio] addStudioMeeting failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function updateStudioMeeting(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const meetingDate = madridInputToIso(strOrNull(formData.get("meeting_date")));

  const { error } = await supabase
    .from("studio_meetings")
    .update({
      meeting_date: meetingDate ?? undefined,
      attendees: parseAttendees(formData),
      summary: strOrNull(formData.get("summary")),
      action_items: strOrNull(formData.get("action_items")),
      recording_url: strOrNull(formData.get("recording_url")),
    })
    .eq("id", id);

  if (error) {
    console.error("[studio] updateStudioMeeting failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}

export async function deleteStudioMeeting(formData: FormData) {
  const supabase = await createClient();
  const id = strOrNull(formData.get("id"));
  const projectId = strOrNull(formData.get("studio_project_id"));
  if (!id || !projectId) throw new Error("Falta id o proyecto");

  const { error } = await supabase
    .from("studio_meetings")
    .delete()
    .eq("id", id);

  if (error) {
    console.error("[studio] deleteStudioMeeting failed:", error);
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/studio/${projectId}`);
}
