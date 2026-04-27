import PDFDocument from "pdfkit";

export interface NdaPdfData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signatureData: string;
  signedAt: Date;
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
    { text: "PROTOTIPALO S.L.", bold: true },
    { text: ", con domicilio en Calle Viriato 27, 28010 Madrid, y CIF B72410665, representada por Manuel de la Viña (en adelante, " },
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
  body(
    "Que ambas partes desean iniciar o continuar una relación comercial que puede implicar el intercambio de información confidencial, incluyendo pero no limitándose a: diseños, planos, modelos 3D, prototipos, procesos de fabricación, estrategias comerciales, datos de clientes y cualquier otra información de carácter reservado.",
  );
  doc.moveDown(0.5);

  heading("ACUERDAN");
  const clauses: [string, string][] = [
    [
      "Definición de información confidencial.",
      "Se considera información confidencial toda aquella información, ya sea oral, escrita, gráfica, electrónica o en cualquier otro soporte, que una parte revele a la otra en el marco de la relación comercial, incluyendo diseños, archivos 3D, especificaciones técnicas, precios, plazos y cualquier dato relativo a proyectos en curso.",
    ],
    [
      "Obligación de confidencialidad.",
      "La parte receptora se compromete a mantener en estricta confidencialidad toda la información recibida, no divulgarla a terceros sin consentimiento previo por escrito de la parte reveladora, y utilizarla únicamente para los fines de la relación comercial entre ambas partes.",
    ],
    [
      "Medidas de protección.",
      "La parte receptora adoptará las medidas de seguridad razonables para proteger la información confidencial, con al menos el mismo grado de protección que aplica a su propia información confidencial.",
    ],
    [
      "Exclusiones.",
      "No se considerará confidencial la información que: (a) sea de dominio público sin culpa de la parte receptora; (b) haya sido recibida legítimamente de un tercero sin restricciones; (c) haya sido desarrollada independientemente por la parte receptora.",
    ],
    [
      "Duración.",
      "Las obligaciones de confidencialidad establecidas en este acuerdo permanecerán vigentes durante un plazo de 2 (dos) años a partir de la fecha de firma, incluso tras la finalización de la relación comercial entre las partes.",
    ],
    [
      "Devolución de información.",
      "A la terminación de la relación comercial o cuando lo solicite la parte reveladora, la parte receptora devolverá o destruirá toda la información confidencial recibida y cualquier copia de la misma.",
    ],
    [
      "Legislación aplicable.",
      "Este acuerdo se regirá por la legislación española. Para cualquier controversia derivada del mismo, las partes se someten a los juzgados y tribunales de Madrid.",
    ],
  ];
  clauses.forEach(([title, txt], i) => {
    doc.font("Helvetica").fontSize(10).fillColor("#333333");
    doc.text(`${i + 1}. `, { continued: true, lineGap: 3 });
    doc.font("Helvetica-Bold").text(`${title} `, { continued: true });
    doc.font("Helvetica").text(txt, { lineGap: 3 });
    doc.moveDown(0.4);
  });

  doc.moveDown(1);
  body("Y en prueba de conformidad, las partes firman el presente acuerdo:");

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
  doc.font("Helvetica").fillColor("#333333").text("Prototipalo S.L.", 50);
  doc.text("Manuel de la Viña", 50);

  doc
    .font("Helvetica-Bold")
    .fillColor("#1a1a1a")
    .text("LA PARTE RECEPTORA", x2, yStart);
  doc.font("Helvetica").fillColor("#333333").text(data.signerCompany || data.signerName, x2);
  doc.text(data.signerName, x2);

  if (data.signatureData) {
    let imgBuf: Buffer;
    const m = /^data:image\/[^;]+;base64,(.*)$/.exec(data.signatureData);
    if (m) {
      imgBuf = Buffer.from(m[1], "base64");
    } else {
      imgBuf = Buffer.from(data.signatureData, "base64");
    }
    doc.image(imgBuf, x2, doc.y + 8, { width: 180, height: 70 });
  }

  doc.end();
  return done;
}
