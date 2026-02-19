export interface GlsShipmentParams {
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPostalCode: string;
  recipientCountry: string; // GLS country code: "34" = ES, "351" = PT, etc.
  recipientPhone?: string;
  recipientEmail?: string;
  packages: number; // number of parcels
  weight: number; // kg
  reference?: string; // client reference (max 15 chars)
  observations?: string;
}

export interface GlsShipmentResult {
  barcode: string; // shipment barcode (codbarras)
  labelPdf: string; // base64-encoded PDF label
  uid: string; // shipment UID in GLS
}

export interface GlsTrackingEvent {
  date: string;
  description: string;
  city?: string;
}
