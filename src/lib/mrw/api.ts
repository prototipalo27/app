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

function authHeaderXml(): string {
  const creds = getCredentials();
  return `
  <soap:Header>
    <tns:AuthInfo>
      <tns:CodigoFranquicia>${escapeXml(creds.franquicia)}</tns:CodigoFranquicia>
      <tns:CodigoAbonado>${escapeXml(creds.abonado)}</tns:CodigoAbonado>
      <tns:CodigoDepartamento></tns:CodigoDepartamento>
      <tns:UserName>${escapeXml(creds.username)}</tns:UserName>
      <tns:Password>${escapeXml(creds.password)}</tns:Password>
    </tns:AuthInfo>
  </soap:Header>`;
}

function wrapSoapEnvelope(header: string, body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tns="http://www.mrw.es/">
  ${header}
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

async function soapRequest(action: string, body: string): Promise<string> {
  const envelope = wrapSoapEnvelope(authHeaderXml(), body);

  const res = await fetch(MRW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `http://www.mrw.es/${action}`,
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
    <tns:TransmEnvio>
      <tns:request>
        <tns:DatosRecogida>
          <tns:Direccion>
            <tns:Via>${escapeXml(MRW_SENDER.address)}</tns:Via>
            <tns:CodigoPostal>${escapeXml(MRW_SENDER.postalCode)}</tns:CodigoPostal>
            <tns:Poblacion>${escapeXml(MRW_SENDER.city)}</tns:Poblacion>
          </tns:Direccion>
          <tns:Nif>${escapeXml(MRW_SENDER.nif)}</tns:Nif>
          <tns:Nombre>${escapeXml(MRW_SENDER.name)}</tns:Nombre>
          <tns:Telefono>${escapeXml(MRW_SENDER.phone)}</tns:Telefono>
        </tns:DatosRecogida>
        <tns:DatosEntrega>
          <tns:Direccion>
            <tns:Via>${escapeXml(params.recipientAddress)}</tns:Via>
            <tns:CodigoPostal>${escapeXml(params.recipientPostalCode)}</tns:CodigoPostal>
            <tns:Poblacion>${escapeXml(params.recipientCity)}</tns:Poblacion>
          </tns:Direccion>
          <tns:Nif></tns:Nif>
          <tns:Nombre>${escapeXml(params.recipientName)}</tns:Nombre>
          <tns:Telefono>${escapeXml(params.recipientPhone || "")}</tns:Telefono>
          <tns:Observaciones>${escapeXml(params.observations || "")}</tns:Observaciones>
        </tns:DatosEntrega>
        <tns:DatosServicio>
          <tns:Fecha>${fecha}</tns:Fecha>
          <tns:Referencia>${escapeXml(params.reference || "")}</tns:Referencia>
          <tns:CodigoServicio>${params.service}</tns:CodigoServicio>
          <tns:NumeroBultos>${params.packages}</tns:NumeroBultos>
          <tns:Peso>${(params.weight * 1000).toFixed(0)}</tns:Peso>
          <tns:EntregaSabado>N</tns:EntregaSabado>
          <tns:Retorno>N</tns:Retorno>
          <tns:ConfirmacionInmediata>N</tns:ConfirmacionInmediata>
          <tns:Reembolso>N</tns:Reembolso>
        </tns:DatosServicio>
      </tns:request>
    </tns:TransmEnvio>`;

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
    <tns:GetEtiquetaEnvio>
      <tns:request>
        <tns:NumeroEnvio>${escapeXml(albaran)}</tns:NumeroEnvio>
        <tns:SeparadorNumerosEnvio>,</tns:SeparadorNumerosEnvio>
        <tns:FechaInicioEnvio></tns:FechaInicioEnvio>
        <tns:FechaFinEnvio></tns:FechaFinEnvio>
        <tns:TipoEtiquetaEnvio>0</tns:TipoEtiquetaEnvio>
        <tns:ReportTopMargin>1100</tns:ReportTopMargin>
        <tns:ReportLeftMargin>650</tns:ReportLeftMargin>
      </tns:request>
    </tns:GetEtiquetaEnvio>`;

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
    <tns:GetEnvios>
      <tns:request>
        <tns:NumeroEnvio>${escapeXml(albaran)}</tns:NumeroEnvio>
      </tns:request>
    </tns:GetEnvios>`;

  const xml = await soapRequest("GetEnvios", body);

  const events: MrwTrackingEvent[] = [];
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
    <tns:CancelarEnvio>
      <tns:request>
        <tns:NumeroEnvio>${escapeXml(albaran)}</tns:NumeroEnvio>
      </tns:request>
    </tns:CancelarEnvio>`;

  const xml = await soapRequest("CancelarEnvio", body);
  const estado = extractTag(xml, "Estado");
  return estado === "1";
}
