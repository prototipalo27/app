"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { syncHoldedDocuments, type SyncResult } from "@/lib/holded/sync";

export async function createProject(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const name = formData.get("name") as string;
  if (!name?.trim()) {
    redirect("/dashboard/projects/new");
  }

  const price = formData.get("price") as string;
  const printTime = formData.get("print_time_minutes") as string;

  const templateId = (formData.get("template_id") as string)?.trim() || null;

  const { data: project, error } = await supabase
    .from("projects")
    .insert({
      name: name.trim(),
      description: (formData.get("description") as string)?.trim() || null,
      project_type: (formData.get("project_type") as string) || "confirmed",
      holded_contact_id: (formData.get("holded_contact_id") as string)?.trim() || null,
      client_name: (formData.get("client_name") as string)?.trim() || null,
      client_email: (formData.get("client_email") as string)?.trim() || null,
      price: price ? parseFloat(price) : null,
      material: (formData.get("material") as string)?.trim() || null,
      assigned_printer: (formData.get("assigned_printer") as string)?.trim() || null,
      print_time_minutes: printTime ? parseInt(printTime, 10) : null,
      notes: (formData.get("notes") as string)?.trim() || null,
      created_by: userData.user.id,
      template_id: templateId,
    })
    .select("id")
    .single();

  if (error || !project) {
    throw new Error(error?.message ?? "Failed to create project");
  }

  // Copy template checklist items to project
  if (templateId) {
    const { data: templateItems } = await supabase
      .from("template_checklist_items")
      .select("name, item_type, position")
      .eq("template_id", templateId)
      .order("position");

    if (templateItems && templateItems.length > 0) {
      await supabase.from("project_checklist_items").insert(
        templateItems.map((item) => ({
          project_id: project.id,
          name: item.name,
          item_type: item.item_type,
          position: item.position,
        }))
      );
    }
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}

export async function updateProjectStatus(formData: FormData) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    redirect("/login");
  }

  const id = formData.get("id") as string;
  const status = formData.get("status") as string;

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath(`/dashboard/projects/${id}`);
  revalidatePath("/dashboard");
}

export async function updateProjectStatusById(id: string, status: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("projects")
    .update({ status })
    .eq("id", id);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath("/dashboard");
  return { success: true };
}

export async function updateProjectDeadline(projectId: string, deadline: string | null) {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    throw new Error("Unauthorized");
  }

  const { error } = await supabase
    .from("projects")
    .update({ deadline })
    .eq("id", projectId);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath("/dashboard");
}

export async function triggerHoldedSync(): Promise<SyncResult> {
  await requireRole("manager");
  const result = await syncHoldedDocuments();
  revalidatePath("/dashboard");
  return result;
}

// ── Send Email from Project ──────────────────────────────

export async function sendProjectEmail(
  projectId: string,
  to: string,
  subject: string,
  body: string,
  replyToMessageId?: string,
  threadId?: string
) {
  const profile = await requireRole("manager");
  const supabase = await createClient();

  if (!to?.trim() || !subject?.trim() || !body?.trim()) {
    throw new Error("Email, asunto y cuerpo son obligatorios");
  }

  // Get the project to find or create the lead link
  const { data: project } = await supabase
    .from("projects")
    .select("lead_id, client_email, client_name")
    .eq("id", projectId)
    .single();

  if (!project) throw new Error("Proyecto no encontrado");

  let leadId = project.lead_id;

  // If no lead linked, try to find or create one
  if (!leadId) {
    const email = to.toLowerCase().trim();

    // Look for existing lead by email
    const { data: existingLead } = await supabase
      .from("leads")
      .select("id")
      .ilike("email", email)
      .limit(1)
      .single();

    if (existingLead) {
      leadId = existingLead.id;
    } else {
      // Create lead from project info
      const { data: newLead } = await supabase
        .from("leads")
        .insert({
          full_name: project.client_name || email.split("@")[0],
          email,
          source: "project",
          status: "new",
        })
        .select("id")
        .single();

      if (newLead) {
        leadId = newLead.id;
      }
    }

    // Link lead to project
    if (leadId) {
      await supabase
        .from("projects")
        .update({ lead_id: leadId })
        .eq("id", projectId);
    }
  }

  if (!leadId) throw new Error("No se pudo vincular un lead al proyecto");

  // Delegate to the same email sending logic
  const { sendEmail } = await import("@/lib/email");

  let inReplyTo: string | undefined;
  let references: string[] | undefined;

  if (replyToMessageId && threadId) {
    inReplyTo = replyToMessageId;

    const { data: threadActivities } = await supabase
      .from("lead_activities")
      .select("metadata")
      .eq("thread_id", threadId)
      .in("activity_type", ["email_sent", "email_received"])
      .order("created_at", { ascending: true });

    references = (threadActivities || [])
      .map((a) => (a.metadata as Record<string, unknown>)?.message_id as string)
      .filter(Boolean);
  }

  const result = await sendEmail({
    to: to.trim(),
    subject: subject.trim(),
    text: body.trim(),
    html: body.trim().replace(/\n/g, "<br>"),
    inReplyTo,
    references,
  });

  const finalThreadId = threadId || result.messageId || `sent-${Date.now()}`;

  await supabase.from("lead_activities").insert({
    lead_id: leadId,
    activity_type: "email_sent",
    content: body.trim(),
    thread_id: finalThreadId,
    metadata: {
      email_to: to.trim(),
      email_subject: subject.trim(),
      message_id: result.messageId || null,
      in_reply_to: inReplyTo || null,
    },
    created_by: profile.id,
  });

  revalidatePath(`/dashboard/projects/${projectId}`);
  revalidatePath(`/dashboard/crm/${leadId}`);
}

export async function discardProject(id: string): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("projects")
    .update({ project_type: "discarded", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/dashboard");
  return { success: true };
}

export async function togglePortalVisibility(
  projectId: string,
  field: "design_visible" | "deliverable_visible",
  value: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("projects")
    .update({ [field]: value })
    .eq("id", projectId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function revokeApproval(
  projectId: string,
  field: "design_approved_at" | "deliverable_approved_at" | "payment_confirmed_at",
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: userData, error: userError } = await supabase.auth.getUser();

  if (userError || !userData.user) {
    return { success: false, error: "Unauthorized" };
  }

  const { error } = await supabase
    .from("projects")
    .update({ [field]: null })
    .eq("id", projectId);

  if (error) return { success: false, error: error.message };

  revalidatePath(`/dashboard/projects/${projectId}`);
  return { success: true };
}

export async function deleteProject(formData: FormData) {
  await requireRole("manager");

  const supabase = await createClient();

  const id = formData.get("id") as string;

  const { error } = await supabase.from("projects").delete().eq("id", id);

  if (error) {
    throw new Error(error.message);
  }

  revalidatePath("/dashboard");
  redirect("/dashboard");
}
