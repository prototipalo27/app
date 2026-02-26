"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import { getOrCreateSubfolder } from "@/lib/google-drive/client";
import { uploadFile, deleteFile } from "@/lib/google-drive/client";

const RRHH_PARENT_FOLDER_ID = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID!;

export async function updateEmployeeProfile(
  userId: string,
  data: {
    full_name?: string;
    birthday?: string | null;
    phone?: string | null;
    hire_date?: string | null;
    career_plan?: string | null;
  },
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_profiles")
    .update({
      full_name: data.full_name ?? null,
      birthday: data.birthday ?? null,
      phone: data.phone ?? null,
      hire_date: data.hire_date ?? null,
      career_plan: data.career_plan ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", userId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/equipo/${userId}`);
  revalidatePath("/dashboard/equipo");
  return { success: true, error: null };
}

export async function uploadEmployeeDocument(formData: FormData) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const file = formData.get("file") as File | null;
  const userId = formData.get("userId") as string;
  const documentType = formData.get("documentType") as string;
  const notes = formData.get("notes") as string | null;
  const employeeName = formData.get("employeeName") as string;

  if (!file || !userId || !documentType) {
    return { success: false, error: "Faltan campos obligatorios" };
  }

  try {
    // Get or create RRHH folder, then employee subfolder
    const rrhhFolderId = await getOrCreateSubfolder(
      RRHH_PARENT_FOLDER_ID,
      "RRHH",
    );
    const employeeFolderId = await getOrCreateSubfolder(
      rrhhFolderId,
      employeeName || userId,
    );

    const buffer = Buffer.from(await file.arrayBuffer());
    const driveFile = await uploadFile(
      employeeFolderId,
      file.name,
      file.type || "application/octet-stream",
      buffer,
    );

    const { error } = await supabase.from("employee_documents").insert({
      user_id: userId,
      file_name: file.name,
      file_path: driveFile.id,
      document_type: documentType,
      notes: notes || null,
      uploaded_by: profile.id,
    });

    if (error) return { success: false, error: error.message };

    revalidatePath(`/dashboard/equipo/${userId}`);
    return { success: true, error: null };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error desconocido";
    return { success: false, error: message };
  }
}

export async function deleteEmployeeDocument(docId: string, userId: string) {
  await requireRole("manager");
  const supabase = await createClient();

  // Get the document to find the Drive file ID
  const { data: doc, error: fetchError } = await supabase
    .from("employee_documents")
    .select("file_path")
    .eq("id", docId)
    .single();

  if (fetchError || !doc) {
    return { success: false, error: "Documento no encontrado" };
  }

  // Delete from Drive
  try {
    await deleteFile(doc.file_path);
  } catch {
    // Continue even if Drive delete fails (file may already be gone)
  }

  // Delete from database
  const { error } = await supabase
    .from("employee_documents")
    .delete()
    .eq("id", docId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/equipo/${userId}`);
  return { success: true, error: null };
}
