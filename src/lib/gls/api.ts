import type { GlsShipmentParams, GlsShipmentResult, GlsTrackingEvent } from "./types";
import { GLS_SENDER } from "./sender";

const GLS_API_URL =
  process.env.GLS_API_URL || "https://ws-customer.gls-spain.es/b2b.asmx";

function getUidCliente(): string {
  const uid = process.env.GLS_UID_CLIENTE?.trim();
  if (!uid) throw new Error("GLS_UID_CLIENTE is not set");
  return uid;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function wrapSoapEnvelope(body: string): string {
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Body>
    ${body}
  </soap:Body>
</soap:Envelope>`;
}

async function soapRequest(
  soapAction: string,
  body: string,
): Promise<string> {
  const envelope = wrapSoapEnvelope(body);

  const res = await fetch(GLS_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: soapAction,
    },
    body: envelope,
    cache: "no-store",
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`GLS SOAP error ${res.status}: ${text}`);
  }

  return res.text();
}

function extractTag(xml: string, tag: string): string {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`);
  const match = xml.match(regex);
  return match ? match[1].trim() : "";
}

/**
 * Creates a shipment via GLS GrabaServicios.
 * Returns barcode, label PDF (base64), and UID.
 */
export async function createShipment(
  params: GlsShipmentParams,
): Promise<GlsShipmentResult> {
  const uid = getUidCliente();
  // Service 96 = BusinessParcel nacional (Spain), 74 = EuroBusinessParcel international
  const serviceCode = params.recipientCountry === "34" ? "96" : "74";
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const body = `
    <GrabaServicios xmlns="http://www.asmred.com/">
      <docIn>
        <Servicios uidcliente="${escapeXml(uid)}" xmlns="http://www.asmred.com/">
          <Envio codbarras="">
            <Fecha>${fecha}</Fecha>
            <Portes>P</Portes>
            <Servicio>${serviceCode}</Servicio>
            <Horario>18</Horario>
            <Bultos>${params.packages}</Bultos>
            <Peso>${params.weight}</Peso>
            <Retorno>0</Retorno>
            <Pod>N</Pod>
            <Remite>
              <Plaza></Plaza>
              <Nombre><![CDATA[${GLS_SENDER.name}]]></Nombre>
              <Direccion><![CDATA[${GLS_SENDER.address}]]></Direccion>
              <Poblacion><![CDATA[${GLS_SENDER.city}]]></Poblacion>
              <Provincia><![CDATA[${GLS_SENDER.province}]]></Provincia>
              <Pais>${GLS_SENDER.country}</Pais>
              <CP>${GLS_SENDER.postalCode}</CP>
              <Telefono><![CDATA[${GLS_SENDER.phone}]]></Telefono>
              <Movil><![CDATA[]]></Movil>
              <Email><![CDATA[${GLS_SENDER.email}]]></Email>
              <Observaciones><![CDATA[]]></Observaciones>
            </Remite>
            <Destinatario>
              <Codigo></Codigo>
              <Plaza></Plaza>
              <Nombre><![CDATA[${params.recipientName}]]></Nombre>
              <Direccion><![CDATA[${params.recipientAddress}]]></Direccion>
              <Poblacion><![CDATA[${params.recipientCity}]]></Poblacion>
              <Provincia><![CDATA[]]></Provincia>
              <Pais>${params.recipientCountry}</Pais>
              <CP>${params.recipientPostalCode}</CP>
              <Telefono><![CDATA[${params.recipientPhone || ""}]]></Telefono>
              <Movil><![CDATA[]]></Movil>
              <Email><![CDATA[${params.recipientEmail || ""}]]></Email>
              <Observaciones><![CDATA[${params.observations || ""}]]></Observaciones>
            </Destinatario>
            <Referencias>
              <Referencia tipo="C"><![CDATA[${(params.reference || "").slice(0, 15)}]]></Referencia>
            </Referencias>
            <DevuelveAdicionales>
              <Etiqueta tipo="PDF"></Etiqueta>
            </DevuelveAdicionales>
          </Envio>
        </Servicios>
      </docIn>
    </GrabaServicios>`;

  const xml = await soapRequest(
    "http://www.asmred.com/GrabaServicios",
    body,
  );

  // Check for errors — extract content of <Errores> and see if there's an <Error> inside
  const errorResult = extractTag(xml, "Errores");
  if (errorResult) {
    const errorMsg = extractTag(errorResult, "Error") || errorResult;
    if (errorMsg && errorMsg.trim() && !errorMsg.includes("<")) {
      throw new Error(`GLS error: ${errorMsg}`);
    }
  }

  // Barcode and uid come as attributes of <Envio codbarras="..." uid="...">
  const barcodeMatch = xml.match(/codbarras="([^"]+)"/);
  const barcode = barcodeMatch?.[1] || "";
  const uidMatch = xml.match(/\buid="([^"]+)"/);
  const uidResult = uidMatch?.[1] || "";

  // Label PDF base64: try multiple tag patterns
  // GLS may return it as <base64Binary>...</base64Binary> or inside <Etiqueta>...<base64Binary>...</base64Binary></Etiqueta>
  let labelPdf = extractTag(xml, "base64Binary");
  if (!labelPdf) {
    // Try extracting from Etiqueta content (might contain nested base64)
    const etiquetaContent = extractTag(xml, "Etiqueta");
    if (etiquetaContent && etiquetaContent.length > 100) {
      // If long enough, it's probably the base64 itself
      labelPdf = etiquetaContent;
    }
  }

  if (!barcode) {
    throw new Error(`GLS: No barcode returned. Response: ${xml.slice(0, 500)}`);
  }

  return { barcode, labelPdf: labelPdf || "", uid: uidResult };
}

/**
 * Gets a PDF label for a barcode (for reprinting).
 * Returns base64-encoded PDF.
 */
export async function getLabel(barcode: string): Promise<string> {
  const uid = getUidCliente();

  const body = `
    <EtiquetaEnvio xmlns="http://www.asmred.com/">
      <uidCliente>${escapeXml(uid)}</uidCliente>
      <codigo>${escapeXml(barcode)}</codigo>
      <tipoEtiqueta>PDF</tipoEtiqueta>
    </EtiquetaEnvio>`;

  const xml = await soapRequest(
    "http://www.asmred.com/EtiquetaEnvio",
    body,
  );

  const pdfBase64 = extractTag(xml, "base64Binary") || extractTag(xml, "EtiquetaEnvioResult");
  if (!pdfBase64) {
    throw new Error("GLS: No label returned");
  }

  return pdfBase64;
}

/**
 * Gets tracking events for a barcode via GetExpCli.
 */
export async function getTracking(
  barcode: string,
): Promise<GlsTrackingEvent[]> {
  const uid = getUidCliente();

  const body = `
    <GetExpCli xmlns="http://www.asmred.com/">
      <codigo>${escapeXml(barcode)}</codigo>
      <uid>${escapeXml(uid)}</uid>
    </GetExpCli>`;

  const xml = await soapRequest(
    "http://www.asmred.com/GetExpCli",
    body,
  );

  // Parse tracking events from response
  const events: GlsTrackingEvent[] = [];
  const trackingSection = extractTag(xml, "GetExpCliResult") || xml;

  // Match individual event entries
  const eventRegex = /<Evento>([\s\S]*?)<\/Evento>/g;
  let match;
  while ((match = eventRegex.exec(trackingSection)) !== null) {
    const eventXml = match[1];
    events.push({
      date: extractTag(eventXml, "Fecha"),
      description: extractTag(eventXml, "Concepto") || extractTag(eventXml, "Descripcion"),
      city: extractTag(eventXml, "Plaza") || undefined,
    });
  }

  return events;
}

/**
 * Cancels a shipment by barcode.
 */
export async function cancelShipment(barcode: string): Promise<boolean> {
  const uid = getUidCliente();

  const body = `
    <Anula xmlns="http://www.asmred.com/">
      <codigo>${escapeXml(barcode)}</codigo>
      <uid>${escapeXml(uid)}</uid>
    </Anula>`;

  const xml = await soapRequest("http://www.asmred.com/Anula", body);

  // Check if cancellation was successful
  const result = extractTag(xml, "AnulaResult");
  return result === "0" || result.toLowerCase().includes("ok");
}
