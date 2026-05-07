import https from "node:https";
import type { MrwShipmentParams, MrwShipmentResult, MrwTrackingEvent } from "./types";
import { MRW_SENDER } from "./sender";

const MRW_API_URL =
  process.env.MRW_API_URL || "https://sagec.mrw.es/MRWEnvio.asmx";

const MRW_TRACKING_URL =
  process.env.MRW_TRACKING_URL ||
  "https://trackingservice.mrw.es/TrackingService.svc/TrackingServices";

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

// Mapeo de códigos de estado MRW (manual TrackingServices, sección 2.6).
// Si MRW no manda EstadoDescripcion, traducimos del numérico para que el
// cliente vea texto entendible en vez de "Estado 16".
const MRW_ESTADO_MAP: Record<string, string> = {
  "00": "Entregado",
  "01": "Destinatario ausente o cerrado",
  "02": "Destinatario desconocido",
  "03": "Dirección de entrega incompleta",
  "04": "Dirección de entrega incorrecta",
  "05": "No acepta el envío",
  "06": "No acepta el reembolso",
  "07": "Pendiente de recoger en franquicia",
  "08": "Devuelto al remitente",
  "09": "Destinatario aplaza la entrega",
  "10": "Emisor aplaza la entrega",
  "11": "En tránsito",
  "12": "Fiesta local",
  "13": "Recibido en franquicia destino",
  "14": "Retenido en franquicia por orden del cliente",
  "15": "En tránsito",
  "16": "En reparto",
  "17": "Envío recogido en origen",
  "18": "Retorno no preparado",
  "19": "Pendiente de recibir datos de entrega",
  "31": "Envío rechazado por embalaje dañado",
  "32": "Devuelto a origen por rotura del contenido",
  "33": "Concertada próxima entrega",
  "35": "Entrega aplazada pendiente de cobro o cita previa",
  "36": "Contactado con el destinatario",
  "39": "Pendiente de recibir datos de recogida",
  "40": "Pendiente de recibir en MRW",
  "41": "Remitente ausente o cerrado",
  "42": "Remitente desconocido",
  "43": "Dirección de recogida incorrecta",
  "44": "Emisor anula la recogida",
  "45": "Emisor aplaza la recogida",
  "46": "Pendiente de recoger",
  "47": "Pendiente de recoger",
  "48": "Pendiente de recoger",
  "49": "Recogido en origen",
  "53": "Dirección de recogida incompleta",
  "57": "En tránsito",
  "58": "En tránsito",
  "59": "En tránsito",
  "60": "Información no disponible, contacta con tu franquicia",
  "61": "Pendiente de recibir datos de entrega",
  "68": "En tránsito",
  "69": "En tránsito",
  "70": "Pendiente de recoger en MRW Point",
  "71": "En tránsito",
  "72": "En tránsito",
  "73": "En reparto",
  "75": "En tránsito",
  "76": "Retirado de MRW Point",
  "77": "En tránsito",
  "78": "En tránsito",
  "79": "En tránsito",
  "90": "En tránsito",
  "91": "Pendiente de recibir datos de entrega",
  "92": "Retenido en aduana",
  "93": "Pendiente de recibir datos de entrega",
  "94": "Cliente ordena destruir el envío",
  "95": "Pendiente de recibir datos de entrega",
  "96": "En tránsito",
};

function mrwEstadoDescripcion(code: string | null | undefined): string | undefined {
  if (!code) return undefined;
  return MRW_ESTADO_MAP[code.padStart(2, "0")];
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Builds a SOAP 1.1 envelope with mrw: prefix (matches EtiquetaEnvio PDF example).
 */
function buildSagecEnvelope(soapAction: string, bodyContent: string): string {
  const creds = getCredentials();
  return `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:mrw="http://www.mrw.es/">
  <soapenv:Header>
    <mrw:AuthInfo>
      <mrw:CodigoFranquicia>${escapeXml(creds.franquicia)}</mrw:CodigoFranquicia>
      <mrw:CodigoAbonado>${escapeXml(creds.abonado)}</mrw:CodigoAbonado>
      <mrw:CodigoDepartamento></mrw:CodigoDepartamento>
      <mrw:UserName>${escapeXml(creds.username)}</mrw:UserName>
      <mrw:Password>${escapeXml(creds.password)}</mrw:Password>
    </mrw:AuthInfo>
  </soapenv:Header>
  <soapenv:Body>
    ${bodyContent}
  </soapenv:Body>
</soapenv:Envelope>`;
}

/**
 * Makes an HTTPS POST request (node:https). Node.js fetch/undici causes 500
 * on this legacy ASMX endpoint, so we use the native https module.
 */
function httpsPost(url: string, headers: Record<string, string>, body: Buffer): Promise<{ status: number; body: string }> {
  const parsed = new URL(url);
  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: parsed.hostname,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { ...headers, "Content-Length": String(body.byteLength) },
      },
      (res) => {
        let data = "";
        res.on("data", (chunk: Buffer) => (data += chunk.toString()));
        res.on("end", () => resolve({ status: res.statusCode ?? 0, body: data }));
      },
    );
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

/**
 * Sends a SOAP 1.1 request to MRW SAGEC endpoint.
 */
async function sagecRequest(soapAction: string, bodyContent: string): Promise<string> {
  const envelope = buildSagecEnvelope(soapAction, bodyContent);
  const buf = Buffer.from(envelope, "utf-8");

  const res = await httpsPost(MRW_API_URL, {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: `"http://www.mrw.es/${soapAction}"`,
  }, buf);

  if (res.status !== 200) {
    throw new Error(`MRW SOAP error ${res.status}: ${res.body.slice(0, 500)}`);
  }

  return res.body;
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

  const bodyContent = `<mrw:TransmEnvio>
      <mrw:request>
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
        <mrw:DatosServicio>
          <mrw:Fecha>${fecha}</mrw:Fecha>
          <mrw:Referencia>${escapeXml(params.reference || "")}</mrw:Referencia>
          <mrw:CodigoServicio>${escapeXml(params.service)}</mrw:CodigoServicio>
          <mrw:NumeroBultos>${params.packages}</mrw:NumeroBultos>
          <mrw:Peso>${Math.ceil(params.weight)}</mrw:Peso>
          <mrw:EntregaSabado>N</mrw:EntregaSabado>
          <mrw:Retorno>N</mrw:Retorno>
          <mrw:ConfirmacionInmediata>N</mrw:ConfirmacionInmediata>
          <mrw:Reembolso>N</mrw:Reembolso>
          <mrw:PortesDebidos>N</mrw:PortesDebidos>
        </mrw:DatosServicio>
      </mrw:request>
    </mrw:TransmEnvio>`;

  const xml = await sagecRequest("TransmEnvio", bodyContent);

  // Check for errors — Estado: 0=Error, 1=OK
  const estado = extractTag(xml, "Estado");
  if (estado === "0" || (estado && estado !== "1")) {
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
 * Gets a PDF label for an albaran number via GetEtiquetaEnvio.
 */
export async function getLabel(albaran: string): Promise<string> {
  const bodyContent = `<mrw:GetEtiquetaEnvio>
      <mrw:request>
        <mrw:NumeroEnvio>${escapeXml(albaran)}</mrw:NumeroEnvio>
        <mrw:SeparadorNumerosEnvio>,</mrw:SeparadorNumerosEnvio>
        <mrw:FechaInicioEnvio></mrw:FechaInicioEnvio>
        <mrw:FechaFinEnvio></mrw:FechaFinEnvio>
        <mrw:TipoEtiquetaEnvio>0</mrw:TipoEtiquetaEnvio>
        <mrw:ReportTopMargin>1100</mrw:ReportTopMargin>
        <mrw:ReportLeftMargin>650</mrw:ReportLeftMargin>
      </mrw:request>
    </mrw:GetEtiquetaEnvio>`;

  const xml = await sagecRequest("GetEtiquetaEnvio", bodyContent);

  const estado = extractTag(xml, "Estado");
  if (estado === "0" || (estado && estado !== "1")) {
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
 * Gets tracking info via MRW TrackingService (separate from SAGEC).
 * Uses SOAP 1.1 with namespace http://tempuri.org/.
 */
export async function getTracking(albaran: string): Promise<MrwTrackingEvent[]> {
  const creds = getCredentials();

  const envelope = `<?xml version="1.0" encoding="utf-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/" xmlns:tem="http://tempuri.org/">
  <soapenv:Header/>
  <soapenv:Body>
    <tem:GetEnvios>
      <tem:login>${escapeXml(creds.username)}</tem:login>
      <tem:pass>${escapeXml(creds.password)}</tem:pass>
      <tem:codigoIdioma>3082</tem:codigoIdioma>
      <tem:tipoFiltro>0</tem:tipoFiltro>
      <tem:valorFiltroDesde>${escapeXml(albaran)}</tem:valorFiltroDesde>
      <tem:valorFiltroHasta>${escapeXml(albaran)}</tem:valorFiltroHasta>
      <tem:fechaDesde></tem:fechaDesde>
      <tem:fechaHasta></tem:fechaHasta>
      <tem:tipoInformacion>1</tem:tipoInformacion>
    </tem:GetEnvios>
  </soapenv:Body>
</soapenv:Envelope>`;

  const buf = Buffer.from(envelope, "utf-8");
  const res = await httpsPost(MRW_TRACKING_URL, {
    "Content-Type": "text/xml; charset=utf-8",
    SOAPAction: '"http://tempuri.org/ITrackingService/GetEnvios"',
  }, buf);

  if (res.status !== 200) {
    throw new Error(`MRW tracking error ${res.status}: ${res.body.slice(0, 500)}`);
  }

  const xml = res.body;

  const events: MrwTrackingEvent[] = [];

  // El response real (verificado contra MRW prod) trae estructura anidada:
  //   <a:Seguimiento>            (wrapper top-level, namespace a)
  //     <a:Abonado>
  //       <a:SeguimientoAbonado>
  //         <a:Seguimiento>      (cada item — mismo nombre y namespace)
  //           <a:Estado>17</a:Estado>
  //           <a:EstadoDescripcion>Envío recogido en origen</a:EstadoDescripcion>
  //           <a:FechaEntrega i:nil="true"/>
  //           <a:Publicado>2026-05-07T18:58:36+02:00</a:Publicado>
  //         </a:Seguimiento>
  //         ...más <a:Seguimiento>
  //       </a:SeguimientoAbonado>
  //     </a:Abonado>
  //   </a:Seguimiento>
  // Filtramos por la presencia de <a:Estado> para distinguir items de los wrappers.
  const segRegex = /<a:Seguimiento>([\s\S]*?)<\/a:Seguimiento>/g;
  let match;
  while ((match = segRegex.exec(xml)) !== null) {
    const item = match[1];
    const estado = extractTag(item, "a:Estado");
    const desc = extractTag(item, "a:EstadoDescripcion");
    if (!estado && !desc) continue;
    events.push({
      date: extractTag(item, "a:Publicado") || extractTag(item, "a:FechaEntrega") || "",
      description: desc || mrwEstadoDescripcion(estado) || `Estado ${estado}`,
      city: undefined,
    });
  }

  // Fallback sin prefijo (por si MRW cambia el formato)
  if (events.length === 0) {
    const segRegex2 = /<Seguimiento>([\s\S]*?)<\/Seguimiento>/g;
    while ((match = segRegex2.exec(xml)) !== null) {
      const item = match[1];
      const estado = extractTag(item, "Estado");
      const desc = extractTag(item, "EstadoDescripcion");
      if (!estado && !desc) continue;
      events.push({
        date: extractTag(item, "Publicado") || extractTag(item, "FechaEntrega") || "",
        description: desc || mrwEstadoDescripcion(estado) || `Estado ${estado}`,
        city: undefined,
      });
    }
  }

  // Ordenar por fecha de Publicado ascendente (MRW devuelve orden no garantizado)
  events.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return da - db;
  });

  return events;
}

/**
 * Cancels a shipment by albaran number via CancelarEnvio.
 */
export async function cancelShipment(albaran: string): Promise<boolean> {
  const bodyContent = `<mrw:CancelarEnvio>
      <mrw:request>
        <mrw:CancelaEnvio>
          <mrw:NumeroEnvioOriginal>${escapeXml(albaran)}</mrw:NumeroEnvioOriginal>
        </mrw:CancelaEnvio>
      </mrw:request>
    </mrw:CancelarEnvio>`;

  const xml = await sagecRequest("CancelarEnvio", bodyContent);
  const estado = extractTag(xml, "Estado");
  return estado === "1";
}
