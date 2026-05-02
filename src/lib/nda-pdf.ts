import PDFDocument from "pdfkit";
import {
  COMPANY_NAME,
  COMPANY_ADDRESS,
  COMPANY_NIF,
  COMPANY_REPRESENTATIVE,
  EXPONEN_TEXT,
  NDA_CLAUSES,
  CLOSING_TEXT,
} from "./nda-text";

export interface NdaPdfData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signatureData: string;
  signedAt: Date;
  /** Firma de Prototipalo (base64 PNG). Si está vacía, sale solo el nombre. */
  companySignatureData?: string | null;
}

export async function generateNdaPdf(data: NdaPdfData): Promise<Buffer> {
  const signedDate = data.signedAt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const doc = new PDFDocument({
    size: "A4",
    margins: { top: 60, left: 50, right: 50, bottom: 60 },
  });

  const chunks: Buffer[] = [];
  const done = new Promise<Buffer>((resolve, reject) => {
    doc.on("data", (c: Buffer) => chunks.push(c));
    doc.on("end", () => resolve(Buffer.concat(chunks)));
    doc.on("error", reject);
  });

  // Title
  doc
    .fillColor("#1a1a1a")
    .font("Helvetica-Bold")
    .fontSize(16)
    .text("ACUERDO DE CONFIDENCIALIDAD", { align: "center" });
  doc.moveDown(2);

  // Date
  doc
    .font("Helvetica-Oblique")
    .fontSize(10)
    .fillColor("#71717a")
    .text(`En Madrid, a ${signedDate}`, { align: "right" });
  doc.moveDown(1.5);

  const heading = (t: string) => {
    doc.font("Helvetica-Bold").fontSize(12).fillColor("#1a1a1a").text(t);
    doc.moveDown(0.5);
  };
  const body = (t: string) => {
    doc.font("Helvetica").fontSize(10).fillColor("#333333").text(t, { lineGap: 3 });
    doc.moveDown(0.6);
  };
  const bodyMixed = (parts: { text: string; bold?: boolean }[]) => {
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    parts.forEach((p, i) => {
      doc
        .font(p.bold ? "Helvetica-Bold" : "Helvetica")
        .text(p.text, { continued: i < parts.length - 1, lineGap: 3 });
    });
    doc.moveDown(0.6);
  };

  heading("REUNIDOS");
  bodyMixed([
    { text: "De una parte, " },
    { text: COMPANY_NAME, bold: true },
    { text: `, con domicilio en ${COMPANY_ADDRESS}, y CIF ${COMPANY_NIF}, representada por ${COMPANY_REPRESENTATIVE} (en adelante, ` },
    { text: '"LA EMPRESA"', bold: true },
    { text: ")." },
  ]);
  bodyMixed([
    { text: "De otra parte, " },
    { text: data.signerCompany || data.signerName, bold: true },
    { text: `, con domicilio en ${data.signerAddress}, y NIF/CIF ${data.signerNif}, representada por ${data.signerName} (en adelante, ` },
    { text: '"LA PARTE RECEPTORA"', bold: true },
    { text: ")." },
  ]);
  doc.moveDown(0.5);

  heading("EXPONEN");
  body(EXPONEN_TEXT);
  doc.moveDown(0.5);

  heading("ACUERDAN");
  NDA_CLAUSES.forEach(([title, txt], i) => {
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    doc.text(`${i + 1}. `, { continued: true, lineGap: 3 });
    doc.font("Helvetica-Bold").text(`${title} `, { continued: true });
    doc.font("Helvetica").text(txt, { lineGap: 3 });
    doc.moveDown(0.4);
  });

  doc.moveDown(1);
  body(CLOSING_TEXT);

  // Signatures: two columns, sharing the same y baseline
  doc.moveDown(1);
  const yStart = doc.y;
  const colWidth = (doc.page.width - 100) / 2;
  const x2 = 50 + colWidth + 10;

  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor("#1a1a1a")
    .text("LA EMPRESA", 50, yStart);
  doc.font("Helvetica").fillColor("#333333").text(COMPANY_NAME, 50);
  doc.text(COMPANY_REPRESENTATIVE, 50);

  if (data.companySignatureData) {
    const buf = decodeBase64Png(data.companySignatureData);
    if (buf) doc.image(buf, 50, doc.y + 8, { width: 180, height: 70 });
  }

  doc
    .font("Helvetica-Bold")
    .fillColor("#1a1a1a")
    .text("LA PARTE RECEPTORA", x2, yStart);
  doc.font("Helvetica").fillColor("#333333").text(data.signerCompany || data.signerName, x2);
  doc.text(data.signerName, x2);

  if (data.signatureData) {
    const buf = decodeBase64Png(data.signatureData);
    if (buf) doc.image(buf, x2, doc.y + 8, { width: 180, height: 70 });
  }

  doc.end();
  return done;
}

function decodeBase64Png(input: string): Buffer | null {
  const m = /^data:image\/[^;]+;base64,(.*)$/.exec(input);
  try {
    return m ? Buffer.from(m[1], "base64") : Buffer.from(input, "base64");
  } catch {
    return null;
  }
}
