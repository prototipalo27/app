import Printer from "ipp";

const PRINTER_URL =
  process.env.LABEL_PRINTER_URL || "ipp://192.168.1.73/printers/etiquetas";

/**
 * Send a PDF buffer to the label printer via IPP.
 * Fails silently — printing should never block the shipment flow.
 */
export async function printLabel(pdfBuffer: Buffer): Promise<void> {
  const printer = new Printer(PRINTER_URL);

  return new Promise<void>((resolve) => {
    printer.execute(
      "Print-Job",
      {
        "operation-attributes-tag": {
          "requesting-user-name": "prototipalo",
          "job-name": "Etiqueta envio",
          "document-format": "application/pdf",
        },
        data: pdfBuffer,
      },
      (err: Error | null, res: { statusCode?: string }) => {
        if (err) {
          console.error("[label-printer] Print error:", err.message);
        } else if (
          res.statusCode &&
          !res.statusCode.startsWith("successful")
        ) {
          console.error("[label-printer] IPP status:", res.statusCode);
        } else {
          console.log("[label-printer] Label sent to printer");
        }
        resolve();
      },
    );
  });
}
