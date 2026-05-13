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

/** Delete a contact by ID */
export async function deleteHoldedContact(id: string): Promise<boolean> {
  const res = await fetch(`${HOLDED_API_BASE}/contacts/${id}`, {
    method: "DELETE",
    headers: { key: getApiKey() },
  });

  return res.ok;
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

/** Create a new contact */
export async function createContact(data: {
  name: string;
  code?: string;
  email?: string;
  phone?: string;
  type?: string;
  billAddress?: {
    address?: string;
    city?: string;
    postalCode?: string;
    province?: string;
    country?: string;
    countryCode?: string;
  };
}): Promise<{ id: string }> {
  const res = await fetch(`${HOLDED_API_BASE}/contacts`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify({ ...data, type: data.type || "client" }),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

/** Update an existing contact */
export async function updateContact(
  id: string,
  data: {
    name?: string;
    code?: string;
    email?: string;
    phone?: string;
    mobile?: string;
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

// ── Payment methods ───────────────────────────────────────

/** List payment methods from Holded */
export async function listPaymentMethods(): Promise<
  Array<{ id: string; name: string }>
> {
  const res = await fetch(`${HOLDED_API_BASE}/paymentmethods`, {
    headers: { key: getApiKey() },
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as Array<{ id: string; name: string }>;
}

/** Get the payment method ID for "Transferencia bancaria" (cached per process) */
let cachedTransferMethodId: string | null = null;

export async function getTransferPaymentMethodId(): Promise<string | null> {
  if (cachedTransferMethodId) return cachedTransferMethodId;

  try {
    const methods = await listPaymentMethods();
    const transfer = methods.find((m) =>
      m.name.toLowerCase().includes("transferencia"),
    );
    if (transfer) {
      cachedTransferMethodId = transfer.id;
      return transfer.id;
    }
  } catch {
    // Silently fail — proforma will be created without payment method
  }

  return null;
}

// ── Documents (write) ─────────────────────────────────────

/** Create a proforma for a contact, optionally with line items */
export async function createProforma(
  contactId: string,
  options?: {
    items?: Array<{
      name: string;
      desc?: string;
      units: number;
      subtotal: number;
      tax: number;
      discount?: number;
    }>;
    notes?: string;
  },
): Promise<{ id: string }> {
  // Resolve payment method ID (Transferencia bancaria) before building body
  const paymentMethodId = await getTransferPaymentMethodId();

  const body: Record<string, unknown> = {
    contactId,
    date: Math.floor(Date.now() / 1000),
    ...(paymentMethodId && { paymentMethodId }),
  };

  if (options?.items && options.items.length > 0) {
    body.items = options.items.map((item) => ({
      name: item.name,
      desc: item.desc || "",
      units: item.units,
      subtotal: item.subtotal,
      tax: item.tax,
      ...(item.discount ? { discount: item.discount } : {}),
    }));
  } else {
    body.desc = "Borrador — pendiente de completar líneas";
  }

  if (options?.notes) body.notes = options.notes;

  const res = await fetch(`${HOLDED_API_BASE}/documents/proform`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

/** Create an estimate (presupuesto no vinculante) for a contact */
export async function createEstimate(
  contactId: string,
  options?: {
    items?: Array<{
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
    contactId,
    date: Math.floor(Date.now() / 1000),
  };

  if (options?.items && options.items.length > 0) {
    body.items = options.items.map((item) => ({
      name: item.name,
      desc: item.desc || "",
      units: item.units,
      subtotal: item.subtotal,
      tax: item.tax,
    }));
  }

  if (options?.notes) body.notes = options.notes;

  const res = await fetch(`${HOLDED_API_BASE}/documents/estimate`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

/** Create an invoice for a contact */
export async function createInvoice(
  contactId: string,
  options?: {
    items?: Array<{
      name: string;
      desc?: string;
      units: number;
      subtotal: number;
      tax: number;
      discount?: number;
    }>;
    notes?: string;
  },
): Promise<{ id: string }> {
  const paymentMethodId = await getTransferPaymentMethodId();

  const body: Record<string, unknown> = {
    contactId,
    date: Math.floor(Date.now() / 1000),
    ...(paymentMethodId && { paymentMethodId }),
  };

  if (options?.items && options.items.length > 0) {
    body.items = options.items.map((item) => ({
      name: item.name,
      desc: item.desc || "",
      units: item.units,
      subtotal: item.subtotal,
      tax: item.tax,
      ...(item.discount ? { discount: item.discount } : {}),
    }));
  }

  if (options?.notes) body.notes = options.notes;

  const res = await fetch(`${HOLDED_API_BASE}/documents/invoice`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    throw new Error(`Holded API error: ${res.status} ${res.statusText}`);
  }

  return (await res.json()) as { id: string };
}

// Registra un pago contra una factura en Holded. Tras esto la factura deja
// de aparecer como pendiente/borrador en su UI y queda totalmente saldada
// si el amount coincide con el total. La fecha se pasa en segundos UNIX.
export async function payInvoice(
  invoiceId: string,
  payment: {
    amount: number;
    date?: number;
    description?: string;
  },
): Promise<{ ok: true } | { ok: false; error: string }> {
  const body: Record<string, unknown> = {
    amount: payment.amount,
    date: payment.date ?? Math.floor(Date.now() / 1000),
  };
  if (payment.description) body.description = payment.description;

  const res = await fetch(`${HOLDED_API_BASE}/documents/invoice/${invoiceId}/pay`, {
    method: "POST",
    headers: { key: getApiKey(), "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    return { ok: false, error: `Holded pay error: ${res.status} ${res.statusText} ${text}` };
  }
  return { ok: true };
}

/** Update a proforma with line items and optional notes */
export async function updateProforma(
  documentId: string,
  data: {
    items: Array<{
      name: string;
      desc?: string;
      units: number;
      subtotal: number;
      tax: number;
      discount?: number;
    }>;
    notes?: string;
  },
): Promise<{ id: string }> {
  const body: Record<string, unknown> = {
    items: data.items.map((p) => ({
      name: p.name,
      desc: p.desc || "",
      units: p.units,
      subtotal: p.subtotal,
      tax: p.tax,
      ...(p.discount ? { discount: p.discount } : {}),
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

  // Read the full response as text first — Holded sometimes returns JSON
  // without a proper content-type header
  const raw = await res.text();

  // Try to parse as JSON (Holded returns { status: 1, data: "<base64>" })
  try {
    const json = JSON.parse(raw);
    const b64 = json.data || json.pdf || json.file;
    if (typeof b64 === "string") {
      const decoded = Buffer.from(b64, "base64");
      // Holded prepends HTTP headers before the actual PDF data
      const decodedStr = decoded.toString("binary");
      const pdfStart = decodedStr.indexOf("%PDF");
      if (pdfStart > 0) {
        return Buffer.from(decodedStr.slice(pdfStart), "binary");
      }
      return decoded;
    }
    throw new Error("Unexpected JSON response from Holded PDF endpoint");
  } catch {
    // Not JSON — treat as raw binary
    const buf = Buffer.from(raw, "binary");
    const str = buf.toString("binary");
    const pdfStart = str.indexOf("%PDF");
    if (pdfStart > 0) {
      return Buffer.from(str.slice(pdfStart), "binary");
    }
    return buf;
  }
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

// ── Treasury ──

export interface HoldedTreasuryAccount {
  id: string;
  name: string;
  balance: number;
  type: string; // "bank", "card", "cash", "gateway"
  iban?: string;
  accountNumber?: number;
}

/** Fetch all treasury accounts (bank accounts, cards, cash) from Holded */
export async function listTreasuryAccounts(): Promise<HoldedTreasuryAccount[]> {
  const res = await fetch(`${HOLDED_API_BASE}/treasury`, {
    headers: { accept: "application/json", key: getApiKey() },
    cache: "no-store",
  });

  if (!res.ok) {
    console.error(`[Holded Treasury] Error: ${res.status} ${res.statusText}`);
    return [];
  }

  return (await res.json()) as HoldedTreasuryAccount[];
}

export interface PendingInvoice {
  id: string;
  contactName: string;
  docNumber: string | null;
  total: number;
  pending: number;
  paid: number;
  date: number;
  dueDate: number;
  status: number;
  isDraft: boolean;
  isOverdue: boolean;
}

export interface PendingReceivables {
  total: number;
  invoices: PendingInvoice[];
}

/**
 * Treat as fully paid when a payment was received and the leftover is small
 * enough to match the gateway-fee + early-payment-discount combo:
 *   - Stripe withholds ~1.5–3% + 0.25€
 *   - Some clients take the 5% "pronto pago" discount
 *   - Both can stack
 * The 8% + 1€ cutoff cleanly separates this noise (≤7% in practice) from
 * legitimate partial payments (≥17% in practice — 50% deposits, anticipos).
 */
function isPaidWithResidual(total: number, paid: number, pending: number) {
  if (paid <= 0 || total <= 0) return false;
  return pending < total * 0.08 + 1;
}

/**
 * Pending receivables: unpaid + partially-paid invoices.
 * Includes drafts (cash-paying clients per business rule).
 * Sums Holded's "Pendiente" field, not the full invoice total.
 * Filters out residuals that match payment-gateway fee patterns.
 */
export async function getPendingReceivables(): Promise<PendingReceivables> {
  const invoices = await listDocuments("invoice");
  const nowSec = Math.floor(Date.now() / 1000);

  const pending: PendingInvoice[] = invoices
    .filter((inv) => inv.status === 0 || inv.status === 2)
    .map((inv) => {
      const total = inv.total || 0;
      const paid = inv.paymentsTotal || 0;
      const pendingAmount =
        typeof inv.paymentsPending === "number"
          ? inv.paymentsPending
          : total - paid;
      return {
        id: inv.id,
        contactName: inv.contactName,
        docNumber: inv.docNumber,
        total,
        pending: pendingAmount,
        paid,
        date: inv.date,
        dueDate: inv.dueDate,
        status: inv.status,
        isDraft: inv.draft === true,
        isOverdue: inv.dueDate > 0 && inv.dueDate < nowSec,
      };
    })
    .filter((inv) => inv.pending > 0)
    .filter((inv) => !isPaidWithResidual(inv.total, inv.paid, inv.pending))
    .sort((a, b) => {
      if (a.isOverdue !== b.isOverdue) return a.isOverdue ? -1 : 1;
      return a.dueDate - b.dueDate;
    });

  const total = pending.reduce((sum, inv) => sum + inv.pending, 0);
  return { total, invoices: pending };
}
