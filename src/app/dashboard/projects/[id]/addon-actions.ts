"use server";

import { createClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { requireRole } from "@/lib/rbac";
import { createProforma, getDocumentPdf } from "@/lib/holded/api";
import { sendEmailOrSchedule, type EmailAttachment } from "@/lib/email";
import { getUserEmailSender } from "@/lib/email-sender";

const IVA_RATE = 21; // %

export interface AddonItemInput {
  name: string;
  quantity: number;
  unit_price: number;
  batch_size?: number;
}

export interface AddProjectAddonResult {
  success: boolean;
  error?: string;
  scenario?: "full_payment_link" | "split_added_to_second";
  paymentUrl?: string;
  proformaDocNumber?: string;
}

/**
 * Añade items "extras" (ampliación) a un proyecto ya facturado.
 *
 * La ampliación es SIEMPRE una venta aparte (también si el proyecto es 50/50):
 * no se mezcla con el 2º pago del trato original ni se mete en su factura (que
 * ya está numerada y bloqueada). Tiene su propio link de pago y, al cobrarse,
 * su propia factura numerada (la emite el webhook de Stripe).
 *
 * Flow:
 *  1. Inserta los items en project_items con is_addon=true.
 *  2. Crea una proforma en Holded con esos items (importe = qty * unit_price + IVA).
 *  3. Crea un Payment Link de Stripe y manda email con link + PDF.
 */
export async function addProjectAddon(
  projectId: string,
  items: AddonItemInput[],
): Promise<AddProjectAddonResult> {
  const profile = await requireRole("comercial");

  if (!items || items.length === 0) {
    return { success: false, error: "No hay items que añadir" };
  }

  // Validar items
  const cleaned: AddonItemInput[] = [];
  for (const it of items) {
    const name = it.name?.trim();
    const qty = Math.floor(Number(it.quantity));
    const price = Number(it.unit_price);
    if (!name) return { success: false, error: "Falta el nombre de algún item" };
    if (!Number.isFinite(qty) || qty <= 0) return { success: false, error: `Cantidad inválida en "${name}"` };
    if (!Number.isFinite(price) || price < 0) return { success: false, error: `Precio inválido en "${name}"` };
    cleaned.push({ name, quantity: qty, unit_price: price, batch_size: Math.max(1, it.batch_size ?? 1) });
  }

  const supabase = await createClient();
  const { data: project, error: projErr } = await supabase
    .from("projects")
    .select("id, name, client_name, client_email, holded_contact_id, payment_option, lead_id")
    .eq("id", projectId)
    .single();

  if (projErr || !project) return { success: false, error: "Proyecto no encontrado" };
  if (!project.holded_contact_id) {
    return { success: false, error: "El proyecto no tiene contacto de Holded — añade los datos de facturación primero" };
  }
  if (!project.client_email) {
    return { success: false, error: "El cliente no tiene email — necesario para enviar la proforma" };
  }


  // 1. Crear proforma en Holded
  let proformaId: string;
  try {
    const proforma = await createProforma(project.holded_contact_id, {
      items: cleaned.map((it) => ({
        name: it.name,
        units: it.quantity,
        subtotal: it.unit_price,
        tax: IVA_RATE,
      })),
      notes: `Ampliación del proyecto ${project.name}`,
    });
    proformaId = proforma.id;
  } catch (e) {
    console.error("[addon] Holded proforma failed", e);
    return { success: false, error: `Error creando proforma en Holded: ${(e as Error).message}` };
  }

  // 2. Insertar items con referencia a la proforma
  const itemsToInsert = cleaned.map((it) => ({
    project_id: projectId,
    name: it.name,
    quantity: it.quantity,
    batch_size: it.batch_size ?? 1,
    unit_price: it.unit_price,
    is_addon: true,
    addon_status: "pending_payment",
    holded_proforma_id: proformaId,
  }));

  const { data: insertedItems, error: insertErr } = await supabase
    .from("project_items")
    .insert(itemsToInsert)
    .select("id");

  if (insertErr || !insertedItems) {
    console.error("[addon] insert items failed", insertErr);
    return { success: false, error: `Error guardando items: ${insertErr?.message}` };
  }

  // 3. Calcular total con IVA para email/Stripe
  const subtotal = cleaned.reduce((s, it) => s + it.unit_price * it.quantity, 0);
  const total = subtotal * (1 + IVA_RATE / 100);
  const totalCents = Math.round(total * 100);

  // 4. Descargar PDF proforma para adjuntar
  let proformaPdf: EmailAttachment | null = null;
  try {
    const pdf = await getDocumentPdf("proform", proformaId);
    proformaPdf = {
      filename: `Proforma-ampliacion-${project.name.replace(/[^a-z0-9]/gi, "_")}.pdf`,
      content: pdf,
      contentType: "application/pdf",
    };
  } catch (e) {
    console.error("[addon] PDF download failed", e);
    // No bloqueamos — el email va sin PDF y se puede mandar a mano
  }

  // 5. Resolver email sender (OAuth/SMTP del comercial)
  const emailSender = await getUserEmailSender(profile.id);
  if (!emailSender) {
    return {
      success: false,
      error: "No tienes método de envío de email configurado. Ve a Ajustes → Email.",
    };
  }

  // 6. Ampliación = venta aparte: SIEMPRE su propio link de pago (también en
  // split — no se mezcla con el 2º pago del trato original). Al pagarse, el
  // webhook emite su factura numerada propia.
  let paymentUrl: string | null = null;
  const scenario: AddProjectAddonResult["scenario"] = "full_payment_link";

  const itemsListHtml = cleaned
    .map((it) => `<li>${it.quantity} × ${it.name} — ${(it.unit_price * it.quantity).toFixed(2)} €</li>`)
    .join("");
  const itemsListText = cleaned
    .map((it) => `- ${it.quantity} × ${it.name} — ${(it.unit_price * it.quantity).toFixed(2)} €`)
    .join("\n");

  {
    try {
      // Payment Link (no caduca) — se envía por email y sigue válido pasados
      // varios días.
      const { createOneTimePaymentLink } = await import("@/lib/stripe/payment-links");
      const link = await createOneTimePaymentLink({
        label: `Ampliación — ${project.name}`,
        amountCents: totalCents,
        metadata: {
          project_id: projectId,
          payment_type: "addon_full",
          item_ids: insertedItems.map((i) => i.id).join(","),
        },
      });

      paymentUrl = link.url;

      // Guardar el id del Payment Link en cada item insertado
      await supabase
        .from("project_items")
        .update({ addon_stripe_session_id: link.id })
        .in("id", insertedItems.map((i) => i.id));
    } catch (e) {
      console.error("[addon] Stripe checkout failed", e);
      return {
        success: false,
        error: `Items y proforma creados, pero falló Stripe: ${(e as Error).message}`,
      };
    }

    // Email full
    await sendEmailOrSchedule(
      {
        to: project.client_email,
        subject: `Ampliación de tu pedido — ${project.name}`,
        text: `Hola ${project.client_name || ""},\n\nHemos añadido a tu pedido los siguientes items:\n\n${itemsListText}\n\nTotal (IVA incl.): ${total.toFixed(2)} €\n\nAdjuntamos la proforma. Para completar el pago de la ampliación, haz click aquí:\n${paymentUrl}\n\nGracias,\nEl equipo de Prototipalo`,
        html: `<p>Hola ${project.client_name || ""},</p><p>Hemos añadido a tu pedido los siguientes items:</p><ul>${itemsListHtml}</ul><p><strong>Total (IVA incl.): ${total.toFixed(2)} €</strong></p><p>Adjuntamos la proforma. Para completar el pago de la ampliación:</p><p><a href="${paymentUrl}" style="display:inline-block;padding:10px 20px;background:#e9473f;color:white;border-radius:8px;text-decoration:none;font-weight:500;">Pagar ampliación</a></p><p>Gracias,<br>El equipo de Prototipalo</p>`,
        emailSender,
        attachments: proformaPdf ? [proformaPdf] : undefined,
      },
      { createdBy: profile.id, leadId: project.lead_id ?? undefined },
    );
  }

  revalidatePath(`/dashboard/projects/${projectId}`);
  return {
    success: true,
    scenario,
    paymentUrl: paymentUrl ?? undefined,
    proformaDocNumber: proformaId,
  };
}
