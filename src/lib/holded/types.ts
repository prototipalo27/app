/** Holded API types — Contacts & Documents (Invoicing module) */

// ── Documents ──────────────────────────────────────────────

export interface HoldedDocumentProduct {
  name: string;
  desc: string;
  units: number;
  price: number;
  tax: number;
  discount: number;
  sku: string;
  productId: string;
}

export interface HoldedDocument {
  id: string;
  contact: string;       // contactId
  contactName: string;
  desc: string;
  docNumber: string;
  date: number;           // unix timestamp
  dueDate: number;
  notes: string;
  status: number;
  currency: string;
  subtotal: number;
  tax: number;
  discount: number;
  total: number;
  products: HoldedDocumentProduct[];
  customFields: unknown[];
}

export type HoldedDocType =
  | "invoice"
  | "proform"
  | "estimate"
  | "salesorder"
  | "creditnote"
  | "salesreceipt"
  | "waybill"
  | "purchase"
  | "purchaseorder"
  | "purchaserefund";

// ── Contacts ───────────────────────────────────────────────

export interface HoldedBillAddress {
  address?: string;
  city?: string;
  postalCode?: string;
  province?: string;
  country?: string;
  countryCode?: string;
}

export interface HoldedContact {
  id: string;
  name: string;
  code: string; // NIF/CIF
  tradeName: string;
  email: string;
  phone: string;
  mobile: string;
  type: string; // "client", "supplier", "creditor", "debtor", etc.
  billAddress: HoldedBillAddress;
  iban: string;
  swift: string;
  groupId: string;
  isPerson: boolean;
  note: string;
  contactPersons: unknown[];
  defaults: Record<string, unknown>;
  socialNetworks: Record<string, string>;
  tags: string[];
  customFields: unknown[];
}
