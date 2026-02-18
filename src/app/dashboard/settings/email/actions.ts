"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { encrypt } from "@/lib/encryption";
import { revalidatePath } from "next/cache";
import nodemailer from "nodemailer";

const PATH = "/dashboard/settings/email";

export async function saveSmtpSettings(formData: FormData): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const smtpEmail = (formData.get("smtp_email") as string)?.trim();
  const smtpPassword = (formData.get("smtp_password") as string)?.trim();
  const displayName = (formData.get("display_name") as string)?.trim();
  const signatureHtml = (formData.get("signature_html") as string)?.trim() || null;

  if (!smtpEmail || !smtpPassword || !displayName) {
    return { success: false, error: "Email, contraseña y nombre son obligatorios" };
  }

  const encryptedPassword = encrypt(smtpPassword);

  const { error } = await supabase
    .from("user_smtp_settings")
    .upsert({
      user_id: profile.id,
      smtp_email: smtpEmail,
      smtp_password_encrypted: encryptedPassword,
      display_name: displayName,
      signature_html: signatureHtml,
      updated_at: new Date().toISOString(),
    });

  if (error) return { success: false, error: error.message };

  revalidatePath(PATH);
  return { success: true };
}

export async function testSmtpConnection(formData: FormData): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");

  const smtpEmail = (formData.get("smtp_email") as string)?.trim();
  const smtpPassword = (formData.get("smtp_password") as string)?.trim();

  if (!smtpEmail || !smtpPassword) {
    return { success: false, error: "Email y contraseña son obligatorios" };
  }

  try {
    const transporter = nodemailer.createTransport({
      service: "gmail",
      auth: { user: smtpEmail, pass: smtpPassword },
    });

    await transporter.verify();
    return { success: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Error de conexión desconocido";
    return { success: false, error: message };
  }
}

export async function deleteSmtpSettings(): Promise<{ success: boolean; error?: string }> {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  const { error } = await supabase
    .from("user_smtp_settings")
    .delete()
    .eq("user_id", profile.id);

  if (error) return { success: false, error: error.message };

  revalidatePath(PATH);
  return { success: true };
}
