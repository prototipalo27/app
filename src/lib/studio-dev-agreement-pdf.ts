import PDFDocument from "pdfkit";
import {
  PROTOTIPALO_LEGAL_NAME,
  PROTOTIPALO_REPRESENTATIVE_NAME,
  PROTOTIPALO_REPRESENTATIVE_POSITION,
} from "./studio-nda-text";
import {
  type AgreementLanguage,
  type CommercialTerms,
  type DevAgreementContext,
  buildPrototipaloIntro,
  buildCounterpartyIntro,
  buildAnd,
  formatEffectiveDate,
  getTitle,
  getEffectiveDateParagraph,
  getPartiesIntroParagraph,
  getRecitalsHeading,
  getRecitalI,
  getRecitalII,
  getRecitalIII,
  getRecitalIV,
  getNowTherefore,
  getClauses,
  getSignaturesHeading,
  getClosingParagraph,
  getOnBehalfOf,
  getSignatureLabels,
  getAnnexHeading,
  getAnnexIntro,
  getAnnexItems,
} from "./studio-dev-agreement-text";

export interface DevAgreementPdfData {
  language: AgreementLanguage;
  terms: CommercialTerms;
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signerPosition?: string;
  signatureData: string;
  signedAt: Date;
  ndaReferenceDate: Date | null;
  projectDescription: string | null | undefined;
  /** Firma de Prototipalo (base64 PNG). Si está vacía, sale solo nombre. */
  companySignatureData?: string | null;
}

export async function generateDevAgreementPdf(data: DevAgreementPdfData): Promise<Buffer> {
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
  const lang = data.language;

  const ctx: DevAgreementContext = {
    language: lang,
    terms: data.terms,
    effectiveDate: data.signedAt,
    ndaReferenceDate: data.ndaReferenceDate,
    projectDescription: data.projectDescription,
    signer: {
      signerName: data.signerName,
      signerCompany: data.signerCompany,
      signerNif: data.signerNif,
      signerAddress: data.signerAddress,
      signerPosition: data.signerPosition,
    },
  };

  // ── Title ───────────────────────────────────────────────
  doc
    .fillColor(HEADING_COLOR)
    .font("Helvetica-Bold")
    .fontSize(15)
    .text(getTitle(lang), { align: "center" });
  doc.moveDown(1.5);

  // ── Effective date paragraph ────────────────────────────
  doc
    .font("Helvetica")
    .fontSize(10)
    .fillColor(TEXT_COLOR)
    .text(getEffectiveDateParagraph(ctx), { lineGap: 3 });
  doc.moveDown(0.6);

  // ── Parties block ───────────────────────────────────────
  doc.text(buildPrototipaloIntro(lang), { lineGap: 3 });
  doc.moveDown(0.3);
  doc.font("Helvetica-Oblique").text(buildAnd(lang));
  doc.font("Helvetica");
  doc.moveDown(0.3);
  doc.text(buildCounterpartyIntro(ctx.signer, lang), { lineGap: 3 });
  doc.moveDown(0.5);
  doc.text(getPartiesIntroParagraph(lang), { lineGap: 3 });
  doc.moveDown(0.8);

  // ── Recitals ────────────────────────────────────────────
  doc.font("Helvetica-Bold").fontSize(11).fillColor(HEADING_COLOR).text(getRecitalsHeading(lang));
  doc.moveDown(0.4);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);

  const recitals = [
    `I. ${getRecitalI(lang)}`,
    `II. ${getRecitalII(data.projectDescription, lang)}`,
    `III. ${getRecitalIII(data.ndaReferenceDate, lang)}`,
    `IV. ${getRecitalIV(lang)}`,
  ];
  recitals.forEach((r) => {
    doc.text(r, { lineGap: 3 });
    doc.moveDown(0.4);
  });
  doc.moveDown(0.4);
  doc.font("Helvetica-Bold").text(getNowTherefore(lang));
  doc.font("Helvetica");
  doc.moveDown(0.6);

  // ── Numbered clauses ────────────────────────────────────
  const clauses = getClauses(ctx);
  clauses.forEach((clause) => {
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
    .text(`14. ${getSignaturesHeading(lang)}`);
  doc.moveDown(0.3);
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text(getClosingParagraph(lang), { lineGap: 3 });
  doc.moveDown(1.2);

  const signedDate = formatEffectiveDate(data.signedAt, lang);
  const labels = getSignatureLabels(lang);
  const onBehalf = getOnBehalfOf(lang);

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
    .text(`${onBehalf} ${PROTOTIPALO_LEGAL_NAME}`, x1, yStart, { width: colWidth });

  if (data.companySignatureData) {
    const buf = decodeBase64Png(data.companySignatureData);
    if (buf) doc.image(buf, x1, yStart + 16, { width: 160, height: 50 });
  }

  const detailsY = yStart + 78;
  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text("_______________________________", x1, detailsY);
  doc.text(`${labels.name}: ${PROTOTIPALO_REPRESENTATIVE_NAME}`, x1);
  doc.text(`${labels.position}: ${PROTOTIPALO_REPRESENTATIVE_POSITION}`, x1);
  doc.text(`${labels.date}: ${signedDate}`, x1);
  doc.text(`${labels.place}: Madrid, ${lang === "es" ? "España" : "Spain"}`, x1);

  // Column 2 — Client
  doc
    .font("Helvetica-Bold")
    .fontSize(10)
    .fillColor(HEADING_COLOR)
    .text(`${onBehalf} ${data.signerCompany || data.signerName}`, x2, yStart, { width: colWidth });

  if (data.signatureData) {
    const buf = decodeBase64Png(data.signatureData);
    if (buf) doc.image(buf, x2, yStart + 16, { width: 160, height: 50 });
  }

  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text("_______________________________", x2, detailsY);
  doc.text(`${labels.name}: ${data.signerName}`, x2);
  doc.text(`${labels.position}: ${data.signerPosition || "—"}`, x2);
  doc.text(`${labels.date}: ${signedDate}`, x2);
  doc.text(`${labels.place}: ${data.signerAddress.split(",").pop()?.trim() || "—"}`, x2);

  // ── Annex A — Commercial summary ────────────────────────
  doc.addPage();
  doc
    .font("Helvetica-Bold")
    .fontSize(13)
    .fillColor(HEADING_COLOR)
    .text(getAnnexHeading(lang), { align: "center" });
  doc.moveDown(0.8);

  doc.font("Helvetica").fontSize(10).fillColor(TEXT_COLOR);
  doc.text(getAnnexIntro(lang), { lineGap: 3 });
  doc.moveDown(0.8);

  const annexItems = getAnnexItems(ctx);
  annexItems.forEach((item) => {
    doc.text(`• ${item}`, { lineGap: 3, indent: 8 });
    doc.moveDown(0.3);
  });

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
