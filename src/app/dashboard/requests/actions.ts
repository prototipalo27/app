"use server";

import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { getUserProfile, hasRole } from "@/lib/rbac";
import { sendPushToAll, sendPushToUser } from "@/lib/push-notifications/server";

// ── Create Request ──────────────────────────────────────────

export async function createRequest(formData: FormData) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();

  const title = formData.get("title") as string;
  const description = formData.get("description") as string;
  const requestType = formData.get("request_type") as string;

  if (!title?.trim() || !description?.trim() || !requestType) {
    redirect("/dashboard/requests/new");
  }

  const { data, error } = await supabase
    .from("improvement_requests")
    .insert({
      title: title.trim(),
      description: description.trim(),
      request_type: requestType,
      requested_by: profile.id,
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(error.message);
  }

  sendPushToAll({
    title: "Nueva solicitud de mejora",
    body: `${profile.email.split("@")[0]}: ${title.trim()}`,
    url: `/dashboard/requests/${data.id}`,
  }).catch(() => {});

  revalidatePath("/dashboard/requests");
  redirect(`/dashboard/requests/${data.id}`);
}

// ── Accept Request ──────────────────────────────────────────

export async function acceptRequest(id: string, priority: string) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("requested_by, title")
    .eq("id", id)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      status: "accepted",
      priority,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  sendPushToUser(request.requested_by, {
    title: "Solicitud aceptada",
    body: `Tu solicitud "${request.title}" ha sido aceptada`,
    url: `/dashboard/requests/${id}`,
  }).catch(() => {});

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}

// ── Reject Request ──────────────────────────────────────────

export async function rejectRequest(id: string, notes: string) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("requested_by, title")
    .eq("id", id)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      status: "rejected",
      manager_notes: notes.trim() || null,
      reviewed_by: profile.id,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  sendPushToUser(request.requested_by, {
    title: "Solicitud rechazada",
    body: `Tu solicitud "${request.title}" ha sido rechazada`,
    url: `/dashboard/requests/${id}`,
  }).catch(() => {});

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}

// ── Resolve Request ─────────────────────────────────────────

export async function resolveRequest(id: string, notes: string) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("requested_by, title")
    .eq("id", id)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      status: "resolved",
      resolved_notes: notes.trim() || null,
      resolved_by: profile.id,
      resolved_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  sendPushToUser(request.requested_by, {
    title: "Solicitud resuelta",
    body: `Tu solicitud "${request.title}" ha sido resuelta. Confirma que estas conforme.`,
    url: `/dashboard/requests/${id}`,
  }).catch(() => {});

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}

// ── Confirm Request ─────────────────────────────────────────

export async function confirmRequest(id: string) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("requested_by")
    .eq("id", id)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");
  if (request.requested_by !== profile.id) {
    throw new Error("Solo el solicitante puede confirmar");
  }

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      status: "confirmed",
      confirmed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}

// ── Reopen Request ──────────────────────────────────────────

export async function reopenRequest(id: string) {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");

  const supabase = await createClient();

  const { data: request } = await supabase
    .from("improvement_requests")
    .select("requested_by, title")
    .eq("id", id)
    .single();

  if (!request) throw new Error("Solicitud no encontrada");
  if (request.requested_by !== profile.id) {
    throw new Error("Solo el solicitante puede reabrir");
  }

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      status: "accepted",
      resolved_notes: null,
      resolved_by: null,
      resolved_at: null,
      confirmed_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  sendPushToAll({
    title: "Solicitud reabierta",
    body: `"${request.title}" ha sido reabierta por el solicitante`,
    url: `/dashboard/requests/${id}`,
  }).catch(() => {});

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}

// ── Delete Request ──────────────────────────────────────────

export async function deleteRequest(id: string) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("improvement_requests")
    .delete()
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath("/dashboard/requests");
  redirect("/dashboard/requests");
}

// ── Update Priority ─────────────────────────────────────────

export async function updatePriority(id: string, priority: string) {
  const profile = await getUserProfile();
  if (!profile || !hasRole(profile.role, "manager")) {
    throw new Error("No autorizado");
  }

  const supabase = await createClient();

  const { error } = await supabase
    .from("improvement_requests")
    .update({
      priority,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);

  if (error) throw new Error(error.message);

  revalidatePath(`/dashboard/requests/${id}`);
  revalidatePath("/dashboard/requests");
}
