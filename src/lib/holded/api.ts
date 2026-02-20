import type { HoldedContact, HoldedDocument, HoldedDocType } from "./types";

const HOLDED_API_BASE = "https://api.holded.com/api/invoicing/v1";

function getApiKey(): string {
  const key = process.env.HOLDED_API_KEY;
  if (!key) throw new Error("HOLDED_API_KEY is not set");
  return key;
}

/** Fetch all contacts from Holded (handles pagination) */
export async function listContacts(): Promise<HoldedContact[]> {
  const all: HoldedContact[] = [];
  let page = 1;

  while (true) {
    const res = await fetch(
      `${HOLDED_API_BASE}/contacts?page=${page}&limit=500`,
      { headers: { key: getApiKey() }, cache: "no-store" },
    );

    if (!res.ok) {
      throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
    }

    const batch = (await res.json()) as HoldedContact[];
    if (batch.length === 0) break;

    all.push(...batch);

    // If we got fewer than the page size, we've reached the end
    if (batch.length < 500) break;
    page++;
  }

  return all;
}

/** Fetch a single contact by ID */
export async function getContact(id: string): Promise<HoldedContact> {
  const res = await fetch(`${HOLDED_API_BASE}/contacts/${id}`, {
    headers: { key: getApiKey() },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as HoldedContact;
}

// ── Documents ──────────────────────────────────────────────

/** List documents by type with optional filters (handles pagination) */
export async function listDocuments(
  docType: HoldedDocType,
  options?: {
    starttmp?: number;
    endtmp?: number;
    contactid?: string;
    billed?: 0 | 1;
    page?: number;
  },
): Promise<HoldedDocument[]> {
  const all: HoldedDocument[] = [];
  let page = options?.page ?? 1;
  const singlePage = options?.page !== undefined;

  while (true) {
    const params = new URLSearchParams({ page: String(page) });
    if (options?.starttmp) params.set("starttmp", String(options.starttmp));
    if (options?.endtmp) params.set("endtmp", String(options.endtmp));
    if (options?.contactid) params.set("contactid", options.contactid);
    if (options?.billed !== undefined) params.set("billed", String(options.billed));

    const res = await fetch(
      `${HOLDED_API_BASE}/documents/${docType}?${params}`,
      { headers: { key: getApiKey() }, cache: "no-store" },
    );

    if (!res.ok) {
      throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
    }

    const batch = (await res.json()) as HoldedDocument[];
    if (batch.length === 0) break;

    all.push(...batch);

    if (singlePage || batch.length < 50) break;
    page++;
  }

  return all;
}

/** Fetch a single document by type and ID */
export async function getDocument(
  docType: HoldedDocType,
  documentId: string,
): Promise<HoldedDocument> {
  const res = await fetch(
    `${HOLDED_API_BASE}/documents/${docType}/${documentId}`,
    { headers: { key: getApiKey() }, cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as HoldedDocument;
}

// ── Contacts (write) ──────────────────────────────────────

/** Update an existing contact */
export async function updateContact(
  id: string,
  data: {
    name?: string;
    code?: string;
    billAddress?: {
      address?: string;
      city?: string;
      postalCode?: string;
      province?: string;
      country?: string;
      countryCode?: string;
    };
  },
): Promise<{ id: string }> {
  const res = await fetch(`${HOLDED_API_BASE}/contacts/${id}`, {
    method: "PUT",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

// ── Documents (write) ─────────────────────────────────────

/** Create a proforma draft for a contact (no line items) */
export async function createProforma(
  contactId: string,
): Promise<{ id: string }> {
  const res = await fetch(`${HOLDED_API_BASE}/documents/proform`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({
      contactId,
      date: Math.floor(Date.now() / 1000),
      desc: "Borrador — pendiente de completar líneas",
    }),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

/** Update a proforma with line items and optional notes */
export async function updateProforma(
  documentId: string,
  data: {
    products: Array<{
      name: string;
      desc?: string;
      units: number;
      subtotal: number;
      tax: number;
    }>;
    notes?: string;
  },
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    products: data.products.map((p) => ({
      name: p.name,
      desc: p.desc || "",
      units: p.units,
      subtotal: p.subtotal,
      tax: p.tax,
    })),
  };
  if (data.notes) body.notes = data.notes;

  const res = await fetch(
    `${HOLDED_API_BASE}/documents/proform/${documentId}`,
    {
      method: "PUT",
      headers: { key: getApiKey(), "Content-Type": "application/json" },
      body: JSON.stringify(body),
    },
  );

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

// ── Document PDF ─────────────────────────────────────────

/** Download a document PDF by type and ID */
export async function getDocumentPdf(
  docType: HoldedDocType,
  documentId: string,
): Promise<Buffer> {
  const res = await fetch(
    `${HOLDED_API_BASE}/documents/${docType}/${documentId}/pdf`,
    { headers: { key: getApiKey() }, cache: "no-store" },
  );

  if (!res.ok) {
    throw new Error(`Holded PDF error: ${res.status} ${res.statusText}`);
  }

  const arrayBuffer = await res.arrayBuffer();
  return Buffer.from(arrayBuffer);
}

// ── Contacts (search) ──────────────────────────────────────

/** Search contacts by name (client-side filtering — Holded API has no search endpoint) */
export async function searchContacts(query: string): Promise<HoldedContact[]> {
  const contacts = await listContacts();
  const q = query.toLowerCase();
  return contacts.filter(
    (c) =>
      c.name.toLowerCase().includes(q) ||
      c.tradeName?.toLowerCase().includes(q) ||
      c.code?.toLowerCase().includes(q) ||
      c.email?.toLowerCase().includes(q)
  );
}
