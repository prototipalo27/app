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

function buildEnvelope(soapAction: string, bodyContent: string): string {
  const creds = getCredentials();
  return `<?xml version="1.0" encoding="utf-8"?>
<soap:Envelope xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance" xmlns:xsd="http://www.w3.org/2001/XMLSchema" xmlns:soap="http://schemas.xmlsoap.org/soap/envelope/">
  <soap:Header>
    <AuthInfo xmlns="http://www.mrw.es/">
      <CodigoFranquicia>${escapeXml(creds.franquicia)}</CodigoFranquicia>
      <CodigoAbonado>${escapeXml(creds.abonado)}</CodigoAbonado>
      <CodigoDepartamento></CodigoDepartamento>
      <UserName>${escapeXml(creds.username)}</UserName>
      <Password>${escapeXml(creds.password)}</Password>
    </AuthInfo>
  </soap:Header>
  <soap:Body>
    <${soapAction} xmlns="http://www.mrw.es/">
      ${bodyContent}
    </${soapAction}>
  </soap:Body>
</soap:Envelope>`;
}

async function soapRequest(action: string, bodyContent: string): Promise<string> {
  const envelope = buildEnvelope(action, bodyContent);

  const res = await fetch(MRW_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "text/xml; charset=utf-8",
      SOAPAction: `"http://www.mrw.es/${action}"`,
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
 */
export async function createShipment(
  params: MrwShipmentParams,
): Promise<MrwShipmentResult> {
  const today = new Date();
  const fecha = `${String(today.getDate()).padStart(2, "0")}/${String(today.getMonth() + 1).padStart(2, "0")}/${today.getFullYear()}`;

  const bodyContent = `
      <request>
        <DatosRecogida>
          <Direccion>
            <Via>${escapeXml(MRW_SENDER.address)}</Via>
            <CodigoPostal>${escapeXml(MRW_SENDER.postalCode)}</CodigoPostal>
            <Poblacion>${escapeXml(MRW_SENDER.city)}</Poblacion>
          </Direccion>
          <Nif>${escapeXml(MRW_SENDER.nif)}</Nif>
          <Nombre>${escapeXml(MRW_SENDER.name)}</Nombre>
          <Telefono>${escapeXml(MRW_SENDER.phone)}</Telefono>
        </DatosRecogida>
        <DatosEntrega>
          <Direccion>
            <Via>${escapeXml(params.recipientAddress)}</Via>
            <CodigoPostal>${escapeXml(params.recipientPostalCode)}</CodigoPostal>
            <Poblacion>${escapeXml(params.recipientCity)}</Poblacion>
          </Direccion>
          <Nif></Nif>
          <Nombre>${escapeXml(params.recipientName)}</Nombre>
          <Telefono>${escapeXml(params.recipientPhone || "")}</Telefono>
          <Observaciones>${escapeXml(params.observations || "")}</Observaciones>
        </DatosEntrega>
        <DatosServicio>
          <Fecha>${fecha}</Fecha>
          <Referencia>${escapeXml(params.reference || "")}</Referencia>
          <CodigoServicio>${params.service}</CodigoServicio>
          <NumeroBultos>${params.packages}</NumeroBultos>
          <Peso>${(params.weight * 1000).toFixed(0)}</Peso>
          <EntregaSabado>N</EntregaSabado>
          <Retorno>N</Retorno>
          <ConfirmacionInmediata>N</ConfirmacionInmediata>
          <Reembolso>N</Reembolso>
        </DatosServicio>
      </request>`;

  const xml = await soapRequest("TransmEnvio", bodyContent);

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
 */
export async function getLabel(albaran: string): Promise<string> {
  const bodyContent = `
      <request>
        <NumeroEnvio>${escapeXml(albaran)}</NumeroEnvio>
        <SeparadorNumerosEnvio>,</SeparadorNumerosEnvio>
        <FechaInicioEnvio></FechaInicioEnvio>
        <FechaFinEnvio></FechaFinEnvio>
        <TipoEtiquetaEnvio>0</TipoEtiquetaEnvio>
        <ReportTopMargin>1100</ReportTopMargin>
        <ReportLeftMargin>650</ReportLeftMargin>
      </request>`;

  const xml = await soapRequest("GetEtiquetaEnvio", bodyContent);

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
  const bodyContent = `
      <request>
        <NumeroEnvio>${escapeXml(albaran)}</NumeroEnvio>
      </request>`;

  const xml = await soapRequest("GetEnvios", bodyContent);

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
  const bodyContent = `
      <request>
        <NumeroEnvio>${escapeXml(albaran)}</NumeroEnvio>
      </request>`;

  const xml = await soapRequest("CancelarEnvio", bodyContent);
  const estado = extractTag(xml, "Estado");
  return estado === "1";
}
