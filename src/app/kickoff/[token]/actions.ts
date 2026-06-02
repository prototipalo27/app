"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import {
  createKickoffEvent,
  getDefaultDesignerCalendarId,
  getDefaultDesignerName,
} from "@/lib/google-calendar/kickoff";
import { sendEmailOrSchedule } from "@/lib/email";

function formatSlotForDesignerEmail(iso: string): string {
  try {
    return new Intl.DateTimeFormat("es-ES", {
      timeZone: "Europe/Madrid",
      weekday: "long",
      day: "numeric",
      month: "long",
      hour: "2-digit",
      minute: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

export async function confirmKickoffSlot(
  token: string,
  slotIso: string,
): Promise<{ ok: false; error: string } | never> {
  const supabase = createServiceClient();

  const { data: project } = await supabase
    .from("projects")
    .select(
      "id, name, client_name, client_email, lead_id, kickoff_token, kickoff_proposed_slots, kickoff_confirmed_at",
    )
    .eq("kickoff_token", token)
    .maybeSingle();

  if (!project) return { ok: false, error: "Enlace no válido" };
  if (project.kickoff_confirmed_at) {
    // Idempotente: si ya confirmó, redirigimos a la página (mostrará el estado).
    redirect(`/kickoff/${token}`);
  }

  const slots = Array.isArray(project.kickoff_proposed_slots)
    ? (project.kickoff_proposed_slots as string[])
    : [];
  if (!slots.includes(slotIso)) {
    return { ok: false, error: "Ese hueco ya no está disponible" };
  }

  // Resolver email del cliente: preferimos el del proyecto, si no el del lead.
  let clientEmail = project.client_email;
  let clientName = project.client_name ?? project.name;
  if ((!clientEmail || !clientName) && project.lead_id) {
    const { data: lead } = await supabase
      .from("leads")
      .select("email, full_name")
      .eq("id", project.lead_id)
      .maybeSingle();
    clientEmail = clientEmail ?? lead?.email ?? null;
    clientName = clientName ?? lead?.full_name ?? "Cliente";
  }

  const calendarId = getDefaultDesignerCalendarId();
  if (!calendarId) {
    return { ok: false, error: "La agenda no está configurada. Contáctanos." };
  }

  try {
    const { eventId, meetingLink } = await createKickoffEvent({
      calendarId,
      designerName: getDefaultDesignerName(),
      startISO: slotIso,
      projectName: project.name,
      clientName: clientName ?? "Cliente",
      clientEmail: clientEmail ?? "",
      projectId: project.id,
    });

    await supabase
      .from("projects")
      .update({
        kickoff_confirmed_slot: slotIso,
        kickoff_confirmed_at: new Date().toISOString(),
        kickoff_event_id: eventId,
        kickoff_meeting_link: meetingLink,
      })
      .eq("id", project.id);

    // Aviso a Isabella: el invite oficial de Calendar va al cliente, pero
    // ella es la organizadora y por defecto no recibe nada. Le mandamos
    // un correo simple para que vea la reserva sin tener que abrir Calendar.
    try {
      const when = formatSlotForDesignerEmail(slotIso);
      const baseUrl =
        process.env.NEXT_PUBLIC_APP_URL ||
        process.env.NEXT_PUBLIC_BASE_URL ||
        "https://app.prototipalo.es";
      const projectUrl = `${baseUrl}/dashboard/projects/${project.id}`;
      const designerName = getDefaultDesignerName();
      const safeClientName = clientName ?? "Cliente";
      const meetingBlock = meetingLink
        ? `<p><strong>Google Meet:</strong> <a href="${meetingLink}">${meetingLink}</a></p>`
        : "";
      const meetingText = meetingLink ? `\nGoogle Meet: ${meetingLink}` : "";
      await sendEmailOrSchedule({
        to: calendarId,
        subject: `Nueva reunión de kickoff — ${safeClientName} (${when})`,
        text: `Hola ${designerName},\n\n${safeClientName} ha reservado un hueco contigo:\n\n${when}${meetingText}\n\nProyecto: ${project.name}\nFicha interna: ${projectUrl}\n\nYa lo tienes en tu calendario.`,
        html: `<p>Hola ${designerName},</p><p><strong>${safeClientName}</strong> ha reservado un hueco contigo:</p><p style="font-size:16px;font-weight:600;">${when}</p>${meetingBlock}<p>Proyecto: ${project.name}<br>Ficha interna: <a href="${projectUrl}">${projectUrl}</a></p><p style="color:#71717a;font-size:13px;">Ya lo tienes en tu calendario.</p>`,
      });
    } catch (notifyErr) {
      console.error("[confirmKickoffSlot] designer notify failed:", notifyErr);
    }

    redirect(`/kickoff/${token}`);
  } catch (err) {
    // redirect() lanza NEXT_REDIRECT, hay que dejarlo pasar.
    if (err instanceof Error && err.message === "NEXT_REDIRECT") throw err;
    const obj = err as { digest?: string } | null;
    if (obj?.digest?.startsWith("NEXT_REDIRECT")) throw err;
    console.error("[confirmKickoffSlot] failed:", err);
    return { ok: false, error: "No pudimos crear la reunión. Intenta de nuevo." };
  }
}
