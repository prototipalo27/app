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

  const body = `
    <GrabaServicios xmlns="http://www.asmred.com/">
      <docIn>
        <Servicios>
          <Servicio>
            <uid_cliente>${escapeXml(uid)}</uid_cliente>
            <codigo_servicio>${serviceCode}</codigo_servicio>
            <codigo_horario>18</codigo_horario>
            <bultos>${params.packages}</bultos>
            <peso>${params.weight}</peso>
            <referencia_c>${escapeXml((params.reference || "").slice(0, 15))}</referencia_c>
            <observaciones>${escapeXml(params.observations || "")}</observaciones>
            <Remite>
              <nombre>${escapeXml(GLS_SENDER.name)}</nombre>
              <direccion>${escapeXml(GLS_SENDER.address)}</direccion>
              <poblacion>${escapeXml(GLS_SENDER.city)}</poblacion>
              <provincia>${escapeXml(GLS_SENDER.province)}</provincia>
              <pais>${escapeXml(GLS_SENDER.country)}</pais>
              <codigo_postal>${escapeXml(GLS_SENDER.postalCode)}</codigo_postal>
              <telefono>${escapeXml(GLS_SENDER.phone)}</telefono>
              <email>${escapeXml(GLS_SENDER.email)}</email>
            </Remite>
            <Destinatario>
              <nombre>${escapeXml(params.recipientName)}</nombre>
              <direccion>${escapeXml(params.recipientAddress)}</direccion>
              <poblacion>${escapeXml(params.recipientCity)}</poblacion>
              <pais>${escapeXml(params.recipientCountry)}</pais>
              <codigo_postal>${escapeXml(params.recipientPostalCode)}</codigo_postal>
              <telefono>${escapeXml(params.recipientPhone || "")}</telefono>
              <email>${escapeXml(params.recipientEmail || "")}</email>
            </Destinatario>
            <DevuelveAdicionales>
              <Etiqueta tipo="PDF" />
            </DevuelveAdicionales>
          </Servicio>
        </Servicios>
      </docIn>
    </GrabaServicios>`;

  const xml = await soapRequest(
    "http://www.asmred.com/GrabaServicios",
    body,
  );

  // Check for errors
  const errorResult = extractTag(xml, "Errores");
  if (errorResult) {
    const errorMsg = extractTag(errorResult, "Error") || errorResult;
    if (errorMsg && !errorMsg.includes("<")) {
      throw new Error(`GLS error: ${errorMsg}`);
    }
  }

  const barcode = extractTag(xml, "codbarras");
  const labelPdf = extractTag(xml, "base64Binary") || extractTag(xml, "Etiqueta");
  const uidResult = extractTag(xml, "uid");

  if (!barcode) {
    throw new Error(`GLS: No barcode returned. Response: ${xml.slice(0, 500)}`);
  }

  return { barcode, labelPdf, uid: uidResult };
}

/**
 * Gets a PDF label for a barcode (for reprinting).
 * Returns base64-encoded PDF.
 */
export async function getLabel(barcode: string): Promise<string> {
  const uid = getUidCliente();

  const body = `
    <EtiquetaEnvio xmlns="http://www.asmred.com/">
      <codigo>${escapeXml(barcode)}</codigo>
      <uid>${escapeXml(uid)}</uid>
      <tipo>PDF</tipo>
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
