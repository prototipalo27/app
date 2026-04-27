export interface NdaPdfData {
  signerName: string;
  signerCompany: string;
  signerNif: string;
  signerAddress: string;
  signatureData: string;
  signedAt: Date;
}

export async function generateNdaPdf(data: NdaPdfData): Promise<Buffer> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfMake = (await import("pdfmake/build/pdfmake")).default as any;
  // pdfmake@0.3 exports the fonts directly at the module level (no .vfs / .default).
  // Older builds nest under .pdfMake.vfs or .vfs. Handle all shapes.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pdfFontsMod = (await import("pdfmake/build/vfs_fonts")) as any;
  const pdfFonts = pdfFontsMod.default ?? pdfFontsMod;
  pdfMake.vfs = pdfFonts.pdfMake?.vfs ?? pdfFonts.vfs ?? pdfFonts;

  const signedDate = data.signedAt.toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  const docDefinition = {
    pageSize: "A4" as const,
    pageMargins: [50, 60, 50, 60] as [number, number, number, number],
    content: [
      {
        text: "ACUERDO DE CONFIDENCIALIDAD",
        style: "title",
        alignment: "center" as const,
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },
      {
        text: `En Madrid, a ${signedDate}`,
        style: "date",
        alignment: "right" as const,
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "REUNIDOS", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        text: [
          { text: "De una parte, ", style: "body" },
          { text: "PROTOTIPALO S.L.", bold: true },
          { text: ", con domicilio en Calle Viriato 27, 28010 Madrid, y CIF B72410665, representada por Manuel de la Viña (en adelante, ", style: "body" },
          { text: '"LA EMPRESA"', bold: true },
          { text: ").", style: "body" },
        ],
        margin: [0, 0, 0, 10] as [number, number, number, number],
      },
      {
        text: [
          { text: "De otra parte, ", style: "body" },
          { text: `${data.signerCompany || data.signerName}`, bold: true },
          { text: `, con domicilio en ${data.signerAddress}, y NIF/CIF ${data.signerNif}, representada por ${data.signerName} (en adelante, `, style: "body" },
          { text: '"LA PARTE RECEPTORA"', bold: true },
          { text: ").", style: "body" },
        ],
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "EXPONEN", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        text: "Que ambas partes desean iniciar o continuar una relación comercial que puede implicar el intercambio de información confidencial, incluyendo pero no limitándose a: diseños, planos, modelos 3D, prototipos, procesos de fabricación, estrategias comerciales, datos de clientes y cualquier otra información de carácter reservado.",
        style: "body",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      { text: "ACUERDAN", style: "heading", margin: [0, 0, 0, 10] as [number, number, number, number] },
      {
        ol: [
          {
            text: [
              { text: "Definición de información confidencial. ", bold: true },
              { text: "Se considera información confidencial toda aquella información, ya sea oral, escrita, gráfica, electrónica o en cualquier otro soporte, que una parte revele a la otra en el marco de la relación comercial, incluyendo diseños, archivos 3D, especificaciones técnicas, precios, plazos y cualquier dato relativo a proyectos en curso." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Obligación de confidencialidad. ", bold: true },
              { text: "La parte receptora se compromete a mantener en estricta confidencialidad toda la información recibida, no divulgarla a terceros sin consentimiento previo por escrito de la parte reveladora, y utilizarla únicamente para los fines de la relación comercial entre ambas partes." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Medidas de protección. ", bold: true },
              { text: "La parte receptora adoptará las medidas de seguridad razonables para proteger la información confidencial, con al menos el mismo grado de protección que aplica a su propia información confidencial." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Exclusiones. ", bold: true },
              { text: "No se considerará confidencial la información que: (a) sea de dominio público sin culpa de la parte receptora; (b) haya sido recibida legítimamente de un tercero sin restricciones; (c) haya sido desarrollada independientemente por la parte receptora." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Duración. ", bold: true },
              { text: "Las obligaciones de confidencialidad establecidas en este acuerdo permanecerán vigentes durante un plazo de 2 (dos) años a partir de la fecha de firma, incluso tras la finalización de la relación comercial entre las partes." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Devolución de información. ", bold: true },
              { text: "A la terminación de la relación comercial o cuando lo solicite la parte reveladora, la parte receptora devolverá o destruirá toda la información confidencial recibida y cualquier copia de la misma." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
          {
            text: [
              { text: "Legislación aplicable. ", bold: true },
              { text: "Este acuerdo se regirá por la legislación española. Para cualquier controversia derivada del mismo, las partes se someten a los juzgados y tribunales de Madrid." },
            ],
            margin: [0, 0, 0, 8] as [number, number, number, number],
          },
        ],
        style: "body",
        margin: [0, 0, 0, 30] as [number, number, number, number],
      },
      {
        text: "Y en prueba de conformidad, las partes firman el presente acuerdo:",
        style: "body",
        margin: [0, 0, 0, 20] as [number, number, number, number],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "LA EMPRESA", bold: true, margin: [0, 0, 0, 5] as [number, number, number, number] },
              { text: "Prototipalo S.L.", style: "body" },
              { text: "Manuel de la Viña", style: "body" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "LA PARTE RECEPTORA", bold: true, margin: [0, 0, 0, 5] as [number, number, number, number] },
              { text: data.signerCompany || data.signerName, style: "body" },
              { text: data.signerName, style: "body" },
              {
                image: data.signatureData,
                width: 180,
                height: 70,
                margin: [0, 10, 0, 0] as [number, number, number, number],
              },
            ],
          },
        ],
      },
    ],
    styles: {
      title: { fontSize: 16, bold: true, color: "#1a1a1a" },
      heading: { fontSize: 12, bold: true, color: "#1a1a1a" },
      body: { fontSize: 10, color: "#333333", lineHeight: 1.5 },
      date: { fontSize: 10, color: "#71717a", italics: true },
    },
    defaultStyle: {
      fontSize: 10,
      color: "#333333",
      lineHeight: 1.5,
    },
  };

  return new Promise((resolve, reject) => {
    try {
      const pdfDoc = pdfMake.createPdf(docDefinition);
      pdfDoc.getBuffer((buffer: Uint8Array) => {
        resolve(Buffer.from(buffer));
      });
    } catch (error) {
      reject(error);
    }
  });
}
