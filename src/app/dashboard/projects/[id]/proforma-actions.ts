"use server";

import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { revalidatePath } from "next/cache";
import {
  createProforma,
  updateProforma,
  getDocumentPdf,
} from "@/lib/holded/api";
import { sendEmail } from "@/lib/email";
import { sendPushToAll } from "@/lib/push-notifications/server";

export interface ProformaLineItem {
  concept: string;
  price: number;
  units: number;
  tax: number; // 0, 4, 10, 21
}

export async function createProformaWithItems(
  projectId: string,
  items: ProformaLineItem[],
  notes?: string,
): Promise<{ success: boolean; error?: string; proformaId?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  // Get project
  const { data: project } = await supabase
    .from("projects")
    .select("id, holded_contact_id, holded_proforma_id, name")
    .eq("id", projectId)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };
  if (!project.holded_contact_id) {
    return { success: false, error: "El proyecto no tiene un contacto de Holded vinculado" };
  }

  try {
    // Create proforma draft
    const proforma = await createProforma(project.holded_contact_id);

    // Add line items
    await updateProforma(proforma.id, {
      products: items.map((item) => ({
        name: item.concept,
        units: item.units,
        subtotal: item.price,
        tax: item.tax,
      })),
      notes: notes || undefined,
    });

    // Calculate total
    const total = items.reduce((sum, item) => {
      const subtotal = item.price * item.units;
      const taxAmount = subtotal * (item.tax / 100);
      return sum + subtotal + taxAmount;
    }, 0);

    // Update project
    await supabase
      .from("projects")
      .update({
        holded_proforma_id: proforma.id,
        price: Math.round(total * 100) / 100,
      })
      .eq("id", projectId);

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true, proformaId: proforma.id };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al crear la proforma",
    };
  }
}

export async function sendProformaToClient(
  projectId: string,
): Promise<{ success: boolean; error?: string }> {
  await requireRole("manager");
  const supabase = await createClient();

  const { data: project } = await supabase
    .from("projects")
    .select("id, name, holded_proforma_id, tracking_token, client_email, client_name, holded_contact_id")
    .eq("id", projectId)
    .single();

  if (!project) return { success: false, error: "Proyecto no encontrado" };
  if (!project.holded_proforma_id) return { success: false, error: "No hay proforma creada" };

  // Get client email — try project.client_email, or fetch from lead
  let clientEmail = project.client_email;
  if (!clientEmail) {
    // Try to get email from Holded contact
    try {
      const { getContact } = await import("@/lib/holded/api");
      if (project.holded_contact_id) {
        const contact = await getContact(project.holded_contact_id);
        clientEmail = contact.email;
      }
    } catch {
      // ignore
    }
  }

  if (!clientEmail) {
    return { success: false, error: "No hay email de cliente configurado" };
  }

  try {
    // Download PDF
    const pdfBuffer = await getDocumentPdf("proform", project.holded_proforma_id);

    // Build magic link
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.prototipalo.com";
    const proformaLink = `${baseUrl}/proforma/${project.tracking_token}`;

    // Send email with PDF attachment + link
    await sendEmail({
      to: clientEmail,
      subject: `Presupuesto — ${project.name}`,
      text: `Hola${project.client_name ? ` ${project.client_name}` : ""},\n\nAdjuntamos el presupuesto para tu proyecto "${project.name}".\n\nPuedes revisarlo y aceptarlo en el siguiente enlace:\n${proformaLink}\n\nSi tienes alguna duda, no dudes en contestar a este email.\n\nGracias,`,
      html: `<p>Hola${project.client_name ? ` ${project.client_name}` : ""},</p>
<p>Adjuntamos el presupuesto para tu proyecto "<strong>${project.name}</strong>".</p>
<p>Puedes revisarlo y aceptarlo en el siguiente enlace:</p>
<p><a href="${proformaLink}" style="display:inline-block;background:#16a34a;color:white;padding:10px 24px;border-radius:8px;text-decoration:none;font-weight:500;">Ver presupuesto y aceptar</a></p>
<p>Si tienes alguna duda, no dudes en contestar a este email.</p>
<p>Gracias,</p>`,
      attachments: [
        {
          filename: `Presupuesto-${project.name.replace(/[^a-zA-Z0-9]/g, "_")}.pdf`,
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });

    // Update proforma_sent_at
    await supabase
      .from("projects")
      .update({ proforma_sent_at: new Date().toISOString() })
      .eq("id", projectId);

    revalidatePath(`/dashboard/projects/${projectId}`);
    return { success: true };
  } catch (e) {
    return {
      success: false,
      error: e instanceof Error ? e.message : "Error al enviar la proforma",
    };
  }
}
