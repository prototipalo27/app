"use server";

import { createServiceClient } from "@/lib/supabase/server";
import { sendEmail } from "@/lib/email";
import { headers } from "next/headers";

interface SignNdaData {
  signer_name: string;
  signer_company: string;
  signer_nif: string;
  signer_address: string;
  signer_email: string;
  signature_data: string; // base64 PNG
}

export async function signNda(
  token: string,
  data: SignNdaData,
): Promise<{ success: boolean; error?: string }> {
  const supabase = createServiceClient();

  // 1. Validate token exists and is pending
  const { data: nda, error: ndaError } = await supabase
    .from("nda_agreements")
    .select("*, leads(full_name, company)")
    .eq("token", token)
    .eq("status", "pending")
    .single();

  if (ndaError || !nda) {
    return { success: false, error: "Enlace no válido o ya firmado" };
  }

  // 2. Get IP and user agent
  const headersList = await headers();
  const ip =
    headersList.get("x-forwarded-for")?.split(",")[0]?.trim() ||
    headersList.get("x-real-ip") ||
    "unknown";
  const userAgent = headersList.get("user-agent") || "unknown";

  // 3. Update NDA with signer data
  const { error: updateError } = await supabase
    .from("nda_agreements")
    .update({
      status: "signed",
      signer_name: data.signer_name.trim(),
      signer_company: data.signer_company.trim(),
      signer_nif: data.signer_nif.trim(),
      signer_address: data.signer_address.trim(),
      signer_email: data.signer_email.trim(),
      signature_data: data.signature_data,
      signed_at: new Date().toISOString(),
      signer_ip: ip,
      signer_user_agent: userAgent,
      updated_at: new Date().toISOString(),
    })
    .eq("id", nda.id);

  if (updateError) {
    return { success: false, error: "Error al guardar la firma" };
  }

  // 4. Generate PDF and send copy by email
  try {
    const pdfBuffer = await generateNdaPdf({
      signerName: data.signer_name.trim(),
      signerCompany: data.signer_company.trim(),
      signerNif: data.signer_nif.trim(),
      signerAddress: data.signer_address.trim(),
      signatureData: data.signature_data,
      signedAt: new Date(),
    });

    await sendEmail({
      to: data.signer_email.trim(),
      subject: "Acuerdo de confidencialidad firmado — Prototipalo",
      signature: false,
      text: `Hola ${data.signer_name.trim()},\n\nAdjuntamos una copia del acuerdo de confidencialidad que acabas de firmar.\n\nGracias por tu confianza.\n\nPrototipalo\nViriato 27 · 28010 Madrid\nprototipalo.com`,
      html: `
        <p>Hola ${data.signer_name.trim()},</p>
        <p>Adjuntamos una copia del acuerdo de confidencialidad que acabas de firmar.</p>
        <p>Gracias por tu confianza.</p>
        <br>
        <table cellpadding="0" cellspacing="0" border="0" style="font-family:Arial,Helvetica,sans-serif;font-size:11px;color:#333333;line-height:1.6;">
          <tr><td style="padding-bottom:10px;"><strong style="font-size:12px;color:#1a1a1a;">Prototipalo</strong></td></tr>
          <tr><td style="padding-bottom:2px;">Viriato 27 &bull; 28010 Madrid</td></tr>
          <tr><td style="padding-bottom:11px;"><a href="https://prototipalo.com" style="color:#2563eb;text-decoration:underline;">Prototipalo.com</a></td></tr>
          <tr><td style="padding-top:11px;"><a href="https://prototipalo.com" style="text-decoration:none;"><img src="https://rqqwvgdmbmgdbegpcvmz.supabase.co/storage/v1/object/public/assets/logo-email.png" alt="prototipalo — better in 3d" width="224" height="auto" style="display:block;" /></a></td></tr>
        </table>
      `,
      attachments: [
        {
          filename: "NDA-Prototipalo.pdf",
          content: pdfBuffer,
          contentType: "application/pdf",
        },
      ],
    });
  } catch {
    // Email/PDF failure should not block the signing
  }

  // 5. Log activity on lead
  try {
    await supabase.from("lead_activities").insert({
      lead_id: nda.lead_id,
      activity_type: "note",
      content: `NDA firmado por ${data.signer_name.trim()} (${data.signer_nif.trim()})`,
      metadata: {
        type: "nda_signed",
        signer_name: data.signer_name.trim(),
        signer_nif: data.signer_nif.trim(),
        signer_email: data.signer_email.trim(),
      },
    });
  } catch {
    // Activity log failure should not block
  }

  return { success: true };
}

// ── PDF Generation ──────────────────────────────────────

interface NdaPdfData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signatureData: string;
  signedAt: Date;
}

async function generateNdaPdf(data: NdaPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = (await import("pdfmake/build/pdfmake")).default as any;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfFonts = (await import("pdfmake/build/vfs_fonts")).default as any;
  pdfMake.vfs = pdfFonts.pdfMake ? pdfFonts.pdfMake.vfs : pdfFonts.vfs;

  const signedDate = data.signedAt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const docDefinition = {
    pageSize: "A4" as const,
    pageMargins: [50, 60, 50, 60] as [number, number, number, number],
    content: [
      {
        text: "ACUERDO DE CONFIDENCIALIDAD",
        style: "title",
        alignment: "center" as const,
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },
      {
        text: `En Madrid, a ${signedDate}`,
        style: "date",
        alignment: "right" as const,
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "REUNIDOS", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        text: [
          { text: "De una parte, ", style: "body" },
          { text: "PROTOTIPALO S.L.", bold: true },
          { text: ", con domicilio en Calle Viriato 27, 28010 Madrid, y CIF B56592953, representada por Manuel de la Viña (en adelante, ", style: "body" },
          { text: '"LA EMPRESA"', bold: true },
          { text: ").", style: "body" },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        text: [
          { text: "De otra parte, ", style: "body" },
          { text: `${data.signerCompany || data.signerName}`, bold: true },
          { text: `, con domicilio en ${data.signerAddress}, y NIF/CIF ${data.signerNif}, representada por ${data.signerName} (en adelante, `, style: "body" },
          { text: '"LA PARTE RECEPTORA"', bold: true },
          { text: ").", style: "body" },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "EXPONEN", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        text: "Que ambas partes desean iniciar o continuar una relación comercial que puede implicar el intercambio de información confidencial, incluyendo pero no limitándose a: diseños, planos, modelos 3D, prototipos, procesos de fabricación, estrategias comerciales, datos de clientes y cualquier otra información de carácter reservado.",
        style: "body",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "ACUERDAN", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        ol: [
          {
            text: [
              { text: "Definición de información confidencial. ", bold: true },
              { text: "Se considera información confidencial toda aquella información, ya sea oral, escrita, gráfica, electrónica o en cualquier otro soporte, que una parte revele a la otra en el marco de la relación comercial, incluyendo diseños, archivos 3D, especificaciones técnicas, precios, plazos y cualquier dato relativo a proyectos en curso." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Obligación de confidencialidad. ", bold: true },
              { text: "La parte receptora se compromete a mantener en estricta confidencialidad toda la información recibida, no divulgarla a terceros sin consentimiento previo por escrito de la parte reveladora, y utilizarla únicamente para los fines de la relación comercial entre ambas partes." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Medidas de protección. ", bold: true },
              { text: "La parte receptora adoptará las medidas de seguridad razonables para proteger la información confidencial, con al menos el mismo grado de protección que aplica a su propia información confidencial." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Exclusiones. ", bold: true },
              { text: "No se considerará confidencial la información que: (a) sea de dominio público sin culpa de la parte receptora; (b) haya sido recibida legítimamente de un tercero sin restricciones; (c) haya sido desarrollada independientemente por la parte receptora." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Duración. ", bold: true },
              { text: "Las obligaciones de confidencialidad establecidas en este acuerdo permanecerán vigentes durante un plazo de 2 (dos) años a partir de la fecha de firma, incluso tras la finalización de la relación comercial entre las partes." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Devolución de información. ", bold: true },
              { text: "A la terminación de la relación comercial o cuando lo solicite la parte reveladora, la parte receptora devolverá o destruirá toda la información confidencial recibida y cualquier copia de la misma." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Legislación aplicable. ", bold: true },
              { text: "Este acuerdo se regirá por la legislación española. Para cualquier controversia derivada del mismo, las partes se someten a los juzgados y tribunales de Madrid." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
        ],
        style: "body",
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },
      {
        text: "Y en prueba de conformidad, las partes firman el presente acuerdo:",
        style: "body",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "LA EMPRESA", bold: true, margin: [0, 0, 0, 5] as [number, number, number, number] },
              { text: "Prototipalo S.L.", style: "body" },
              { text: "Manuel de la Viña", style: "body" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "LA PARTE RECEPTORA", bold: true, margin: [0, 0, 0, 5] as [number, number, number, number] },
              { text: data.signerCompany || data.signerName, style: "body" },
              { text: data.signerName, style: "body" },
              {
                image: data.signatureData,
                width: 180,
                height: 70,
                margin: [0, 10, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ],
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true, color: "#1a1a1a" },
      heading: { fontSize: 12, bold: true, color: "#1a1a1a" },
      body: { fontSize: 10, color: "#333333", lineHeight: 1.5 },
      date: { fontSize: 10, color: "#71717a", italics: true },
    },
    defaultStyle: {
      fontSize: 10,
      color: "#333333",
      lineHeight: 1.5,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Uint8Array) => {
        resolve(Buffer.from(buffer));
      });
    } catch (error) {
      reject(error);
    }
  });
}
