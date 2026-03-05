import type { MrwShipmentParams, MrwShipmentResult, MrwTrackingEvent } from "./types";
import { MRW_SENDER } from "./sender";

const MRW_API_URL =
  process.env.MRW_API_URL || "https://sagec-test.mrw.es/MRWEnvio.asmx";

function getCredentials() {
  const franquicia = process.env.MRW_FRANQUICIA?.trim();
  const abonado = process.env.MRW_ABONADO?.trim();
  const username = process.env.MRW_USERNAME?.trim();
  const password = process.env.MRW_PASSWORD?.trim();

  if (!franquicia || !abonado || !username || !password) {
    throw new Error("MRW credentials not configured (MRW_FRANQUICIA, MRW_ABONADO, MRW_USERNAME, MRW_PASSWORD)");
  }

  return { franquicia, abonado, username, password };
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function authInfoXml(): string {
  const creds = getCredentials();
  return `
    <mrw:AuthInfo>
      <mrw:CodigoFranquicia>${escapeXml(creds.franquicia)}</mrw:CodigoFranquicia>
      <mrw:CodigoAbonado>${escapeXml(creds.abonado)}</mrw:CodigoAbonado>
      <mrw:CodigoDepartamento></mrw:CodigoDepartamento>
      <mrw:UserName>${escapeXml(creds.username)}</mrw:UserName>
      <mrw:Password>${escapeXml(creds.password)}</mrw:Password>
    </mrw:AuthInfo>`;
}

function wrapSoapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap12:Envelope xmlns:soap12="http://www.w3.org/2003/05/soap-envelope" xmlns:mrw="http://www.mrw.es/">
  <soap12:Body>
    ${body}
  </soap12:Body>
</soap12:Envelope>`;
}

async function soapRequest(action: string, body: string): Promise<string> {
  const envelope = wrapSoapEnvelope(body);

  const res = await fetch(MRW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/soap+xml; charset=utf-8; action=\"http://www.mrw.es/${action}\"",
    },
    body: envelope,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`MRW SOAP error ${res.status}: ${text.slice(0, 500)}`);
  }

  return res.text();
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Creates a shipment via MRW TransmEnvio.
 * Returns albaran number and label PDF (base64).
 */
export async function createShipment(
  params: MrwShipmentParams,
): Promise<MrwShipmentResult> {
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const body = `
    <mrw:TransmEnvio>
      ${authInfoXml()}
      <mrw:TransmEnvioRequest>
        <mrw:DatosEntrega>
          <mrw:Direccion>
            <mrw:Via>${escapeXml(params.recipientAddress)}</mrw:Via>
            <mrw:CodigoPostal>${escapeXml(params.recipientPostalCode)}</mrw:CodigoPostal>
            <mrw:Poblacion>${escapeXml(params.recipientCity)}</mrw:Poblacion>
          </mrw:Direccion>
          <mrw:Nif></mrw:Nif>
          <mrw:Nombre>${escapeXml(params.recipientName)}</mrw:Nombre>
          <mrw:Telefono>${escapeXml(params.recipientPhone || "")}</mrw:Telefono>
          <mrw:Observaciones>${escapeXml(params.observations || "")}</mrw:Observaciones>
        </mrw:DatosEntrega>
        <mrw:DatosRecogida>
          <mrw:Direccion>
            <mrw:Via>${escapeXml(MRW_SENDER.address)}</mrw:Via>
            <mrw:CodigoPostal>${escapeXml(MRW_SENDER.postalCode)}</mrw:CodigoPostal>
            <mrw:Poblacion>${escapeXml(MRW_SENDER.city)}</mrw:Poblacion>
          </mrw:Direccion>
          <mrw:Nif>${escapeXml(MRW_SENDER.nif)}</mrw:Nif>
          <mrw:Nombre>${escapeXml(MRW_SENDER.name)}</mrw:Nombre>
          <mrw:Telefono>${escapeXml(MRW_SENDER.phone)}</mrw:Telefono>
        </mrw:DatosRecogida>
        <mrw:DatosServicio>
          <mrw:Fecha>${fecha}</mrw:Fecha>
          <mrw:Referencia>${escapeXml(params.reference || "")}</mrw:Referencia>
          <mrw:CodigoServicio>${params.service}</mrw:CodigoServicio>
          <mrw:NumeroBultos>${params.packages}</mrw:NumeroBultos>
          <mrw:Peso>${(params.weight * 1000).toFixed(0)}</mrw:Peso>
          <mrw:EntregaSabado>N</mrw:EntregaSabado>
          <mrw:Retorno>N</mrw:Retorno>
          <mrw:ConfirmacionInmediata>N</mrw:ConfirmacionInmediata>
          <mrw:Reembolso>N</mrw:Reembolso>
          <mrw:NotificacionSMS>N</mrw:NotificacionSMS>
          <mrw:NotificacionEmail>${params.recipientEmail ? "S" : "N"}</mrw:NotificacionEmail>
          ${params.recipientEmail ? `<mrw:MailDestino>${escapeXml(params.recipientEmail)}</mrw:MailDestino>` : ""}
        </mrw:DatosServicio>
      </mrw:TransmEnvioRequest>
    </mrw:TransmEnvio>`;

  const xml = await soapRequest("TransmEnvio", body);

  // Check for errors
  const estado = extractTag(xml, "Estado");
  if (estado && estado !== "1") {
    const mensaje = extractTag(xml, "Mensaje") || "Error desconocido de MRW";
    throw new Error(`MRW error: ${mensaje}`);
  }

  const albaran = extractTag(xml, "NumeroEnvio");
  if (!albaran) {
    throw new Error(`MRW: No albaran returned. Response: ${xml.slice(0, 500)}`);
  }

  // Get label immediately
  let labelPdf = "";
  try {
    labelPdf = await getLabel(albaran);
  } catch {
    // Label fetch failed, but shipment was created
  }

  return { albaran, labelPdf };
}

/**
 * Gets a PDF label for an albaran number.
 * Returns base64-encoded PDF.
 */
export async function getLabel(albaran: string): Promise<string> {
  const body = `
    <mrw:GetEtiquetaEnvio>
      ${authInfoXml()}
      <mrw:EtiquetaEnvioRequest>
        <mrw:NumeroEnvio>${escapeXml(albaran)}</mrw:NumeroEnvio>
        <mrw:SeparadorNumerosEnvio>,</mrw:SeparadorNumerosEnvio>
        <mrw:FechaInicioEnvio></mrw:FechaInicioEnvio>
        <mrw:FechaFinEnvio></mrw:FechaFinEnvio>
        <mrw:TipoEtiquetaEnvio>0</mrw:TipoEtiquetaEnvio>
        <mrw:ReportTopMargin>1100</mrw:ReportTopMargin>
        <mrw:ReportLeftMargin>650</mrw:ReportLeftMargin>
      </mrw:EtiquetaEnvioRequest>
    </mrw:GetEtiquetaEnvio>`;

  const xml = await soapRequest("GetEtiquetaEnvio", body);

  const estado = extractTag(xml, "Estado");
  if (estado && estado !== "1") {
    const mensaje = extractTag(xml, "Mensaje") || "Error obteniendo etiqueta";
    throw new Error(`MRW label error: ${mensaje}`);
  }

  const pdfBase64 = extractTag(xml, "EtiquetaFile");
  if (!pdfBase64) {
    throw new Error("MRW: No label PDF returned");
  }

  return pdfBase64;
}

/**
 * Gets tracking info for an albaran via GetEnvios.
 */
export async function getTracking(albaran: string): Promise<MrwTrackingEvent[]> {
  const body = `
    <mrw:GetEnvios>
      ${authInfoXml()}
      <mrw:GetEnviosRequest>
        <mrw:NumeroEnvio>${escapeXml(albaran)}</mrw:NumeroEnvio>
      </mrw:GetEnviosRequest>
    </mrw:GetEnvios>`;

  const xml = await soapRequest("GetEnvios", body);

  const events: MrwTrackingEvent[] = [];
  // Parse SeguimientoEnvio entries
  const segRegex = /<SeguimientoEnvioItem>([\s\S]*?)<\/SeguimientoEnvioItem>/g;
  let match;
  while ((match = segRegex.exec(xml)) !== null) {
    const item = match[1];
    events.push({
      date: extractTag(item, "Fecha") || extractTag(item, "FechaHora"),
      description: extractTag(item, "EstadoMercancia") || extractTag(item, "Comentario"),
      city: extractTag(item, "Poblacion") || undefined,
    });
  }

  return events;
}

/**
 * Cancels a shipment by albaran number.
 */
export async function cancelShipment(albaran: string): Promise<boolean> {
  const body = `
    <mrw:CancelarEnvio>
      ${authInfoXml()}
      <mrw:CancelarEnvioRequest>
        <mrw:NumeroEnvio>${escapeXml(albaran)}</mrw:NumeroEnvio>
      </mrw:CancelarEnvioRequest>
    </mrw:CancelarEnvio>`;

  const xml = await soapRequest("CancelarEnvio", body);
  const estado = extractTag(xml, "Estado");
  return estado === "1";
}
