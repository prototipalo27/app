export interface MrwShipmentParams {
  recipientName: string;
  recipientAddress: string;
  recipientCity: string;
  recipientPostalCode: string;
  recipientCountry?: string; // ISO 2-letter, defaults to "ES"
  recipientPhone?: string;
  recipientEmail?: string;
  packages: number;
  weight: number; // kg (integers recommended)
  reference?: string;
  observations?: string;
  service: string; // MRW service code: 0200=Urg19, 0300=Economico, 0800=Ecommerce, etc.
}

export interface MrwShipmentResult {
  albaran: string; // NumeroEnvio / albaran number (12 chars)
  labelPdf: string; // base64-encoded PDF
}

export interface MrwTrackingEvent {
  date: string;
  description: string;
  city?: string;
}
