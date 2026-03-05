export interface MrwShipmentParams {
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPostalCode: string;
  recipientCountry?: string; // ISO 2-letter, defaults to "ES"
  recipientPhone?: string;
  recipientEmail?: string;
  packages: number;
  weight: number; // kg
  reference?: string;
  observations?: string;
  service: "0000" | "0005" | "0010"; // 0000=19h, 0005=14h, 0010=10h
}

export interface MrwShipmentResult {
  albaran: string; // NumeroEnvio / albaran number
  labelPdf: string; // base64-encoded PDF
}

export interface MrwTrackingEvent {
  date: string;
  description: string;
  city?: string;
}
