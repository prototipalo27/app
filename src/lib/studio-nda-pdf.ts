import PDFDocument from "pdfkit";
import {
  PROTOTIPALO_LEGAL_NAME,
  PROTOTIPALO_REPRESENTATIVE_NAME,
  PROTOTIPALO_REPRESENTATIVE_POSITION,
  buildPrototipaloIntro,
  buildCounterpartyIntro,
  buildRecitalI,
  RECITAL_II,
  RECITAL_III,
  PARTIES_INTRO_PARAGRAPH,
  NOW_THEREFORE,
  STUDIO_NDA_CLAUSES,
  CLOSING_PARAGRAPH,
  formatEffectiveDate,
} from "./studio-nda-text";

export interface StudioNdaPdfData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signerPosition?: string;
  signatureData: string;
  signedAt: Date;
  projectDescription: string | null | undefined;
  /** Firma de Prototipalo (base64 PNG). Si está vacía, sale solo nombre. */
  companySignatureData?: string | null;
}

export async function generateStudioNdaPdf(data: StudioNdaPdfData): Promise<Buffer> {
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

  const TEXT_COLOR = "#333333";
  const HEADING_COLOR = "#1a1a1a";

  // ── Title ───────────────────────────────────────────────
  doc
    .fillColor(HEADING_COLOR)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text("MUTUAL NON-DISCLOSURE AGREEMENT", { align: "center" });
  doc.moveDown(1.5);

  // ── Effective date paragraph ────────────────────────────
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(TEXT_COLOR)
    .text(
      `This Mutual Non-Disclosure Agreement (the "Agreement") is entered into and made effective as of ${formatEffectiveDate(data.signedAt)} (the "Effective Date") by and between:`,
      { lineGap: 3 },
    );
  doc.moveDown(0.6);

  // ── Parties block ───────────────────────────────────────
  doc.text(buildPrototipaloIntro(), { lineGap: 3 });
  doc.moveDown(0.3);
  doc.font("Helvetica-Oblique").text("and");
  doc.font("Helvetica");
  doc.moveDown(0.3);
  doc.text(
    buildCounterpartyIntro({
      signerName: data.signerName,
      signerCompany: data.signerCompany,
      signerNif: data.signerNif,
      signerAddress: data.signerAddress,
      signerPosition: data.signerPosition,
    }),
    { lineGap: 3 },
  );
  doc.moveDown(0.5);
  doc.text(PARTIES_INTRO_PARAGRAPH, { lineGap: 3 });
  doc.moveDown(0.8);

  // ── Recitals ────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(11).fillColor(HEADING_COLOR).text("RECITALS");
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);

  const recitals = [
    `I. ${buildRecitalI(data.projectDescription)}`,
    `II. ${RECITAL_II}`,
    `III. ${RECITAL_III}`,
  ];
  recitals.forEach((r) => {
    doc.text(r, { lineGap: 3 });
    doc.moveDown(0.4);
  });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").text(NOW_THEREFORE);
  doc.font("Helvetica");
  doc.moveDown(0.6);

  // ── Numbered clauses ────────────────────────────────────
  STUDIO_NDA_CLAUSES.forEach((clause) => {
    doc
      .font("Helvetica-Bold")
      .fontSize(11)
      .fillColor(HEADING_COLOR)
      .text(`${clause.number}. ${clause.title}`);
    doc.moveDown(0.3);
    doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);

    if (clause.subsections) {
      clause.subsections.forEach((s) => {
        doc.text(`${s.number} ${s.text}`, { lineGap: 3 });
        doc.moveDown(0.4);
      });
    }
    if (clause.body && !clause.subsections) {
      doc.text(clause.body, { lineGap: 3 });
      doc.moveDown(0.4);
    }
    if (clause.letteredItems) {
      clause.letteredItems.forEach((item) => {
        doc.text(`(${item.letter}) ${item.text}`, {
          lineGap: 3,
          indent: 12,
        });
        doc.moveDown(0.2);
      });
      doc.moveDown(0.2);
    }
    if (clause.body && clause.subsections) {
      // 1.2 — body after the lettered list
      doc.text(clause.body, { lineGap: 3 });
      doc.moveDown(0.4);
    }
    doc.moveDown(0.3);
  });

  // ── Closing + signatures ────────────────────────────────
  doc.moveDown(0.4);
  doc
    .font("Helvetica-Bold")
    .fontSize(11)
    .fillColor(HEADING_COLOR)
    .text("16. SIGNATURES");
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text(CLOSING_PARAGRAPH, { lineGap: 3 });
  doc.moveDown(1.2);

  const signedDate = data.signedAt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/Madrid",
  });

  // Two signature columns on the same baseline.
  const yStart = doc.y;
  const colWidth = (doc.page.width - 100) / 2;
  const x1 = 50;
  const x2 = 50 + colWidth + 10;

  // Column 1 — Prototipalo
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(HEADING_COLOR)
    .text(`On behalf of ${PROTOTIPALO_LEGAL_NAME}`, x1, yStart, { width: colWidth });

  if (data.companySignatureData) {
    const buf = decodeBase64Png(data.companySignatureData);
    if (buf) doc.image(buf, x1, yStart + 16, { width: 160, height: 50 });
  }

  const detailsY = yStart + 78;
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text("_______________________________", x1, detailsY);
  doc.text(`Name: ${PROTOTIPALO_REPRESENTATIVE_NAME}`, x1);
  doc.text(`Position: ${PROTOTIPALO_REPRESENTATIVE_POSITION}`, x1);
  doc.text(`Date: ${signedDate}`, x1);
  doc.text(`Place: Madrid, Spain`, x1);

  // Column 2 — Counterparty
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(HEADING_COLOR)
    .text(`On behalf of ${data.signerCompany || data.signerName}`, x2, yStart, { width: colWidth });

  // Place signature image roughly where the line would be.
  if (data.signatureData) {
    const buf = decodeBase64Png(data.signatureData);
    if (buf) doc.image(buf, x2, yStart + 16, { width: 160, height: 50 });
  }

  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text("_______________________________", x2, detailsY);
  doc.text(`Name: ${data.signerName}`, x2);
  doc.text(`Position: ${data.signerPosition || "—"}`, x2);
  doc.text(`Date: ${signedDate}`, x2);
  doc.text(`Place: ${data.signerAddress.split(",").pop()?.trim() || "—"}`, x2);

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
