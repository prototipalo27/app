import { google, type gmail_v1 } from "googleapis";

const GMAIL_SCOPES = [
  "https://www.googleapis.com/auth/gmail.readonly",
  "https://www.googleapis.com/auth/gmail.modify",
];

/**
 * Service Account with domain-wide delegation impersonating the shared inbox.
 * Requires:
 *   1. Domain-wide delegation enabled for the SA in Google Workspace Admin
 *   2. Scopes authorized in Admin → Security → API Controls → Domain-wide delegation
 */
function formatPrivateKey(raw: string): string {
  let key = raw
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");

  const lines = key.match(/.{1,64}/g) ?? [];
  return [
    "-----BEGIN PRIVATE KEY-----",
    ...lines,
    "-----END PRIVATE KEY-----",
    "",
  ].join("\n");
}

export function getGmailClient(
  impersonateEmail = "info@prototipalo.com",
): gmail_v1.Gmail {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const privateKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (!email || !privateKey) {
    throw new Error("Missing Google Service Account credentials");
  }

  const auth = new google.auth.JWT({
    email,
    key: formatPrivateKey(privateKey),
    scopes: GMAIL_SCOPES,
    subject: impersonateEmail, // domain-wide delegation
  });

  return google.gmail({ version: "v1", auth });
}

export interface ParsedEmail {
  from: string;
  from_name: string;
  to: string;
  cc: string;
  subject: string;
  body: string;
  message_id: string | null;
  in_reply_to: string | null;
  date: string;
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string,
): string {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value || "";
}

function extractBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return "";

  // Simple body
  if (payload.body?.data) {
    return Buffer.from(payload.body.data, "base64url").toString("utf-8");
  }

  // Multipart — prefer text/plain, fall back to text/html
  if (payload.parts) {
    const textPart = payload.parts.find((p) => p.mimeType === "text/plain");
    if (textPart?.body?.data) {
      return Buffer.from(textPart.body.data, "base64url").toString("utf-8");
    }

    const htmlPart = payload.parts.find((p) => p.mimeType === "text/html");
    if (htmlPart?.body?.data) {
      const html = Buffer.from(htmlPart.body.data, "base64url").toString("utf-8");
      // Strip HTML tags for a rough text version
      return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
    }

    // Nested multipart (e.g. multipart/alternative inside multipart/mixed)
    for (const part of payload.parts) {
      const nested = extractBody(part);
      if (nested) return nested;
    }
  }

  return "";
}

function parseEmailAddress(raw: string): { email: string; name: string } {
  // "Juan Pérez <juan@example.com>" → { email, name }
  const match = raw.match(/^(.+?)\s*<([^>]+)>$/);
  if (match) {
    return { name: match[1].replace(/^["']|["']$/g, "").trim(), email: match[2].toLowerCase().trim() };
  }
  return { name: raw.split("@")[0], email: raw.toLowerCase().trim() };
}

export function parseMessage(msg: gmail_v1.Schema$Message): ParsedEmail {
  const headers = msg.payload?.headers;
  const fromRaw = getHeader(headers, "From");
  const { email: fromEmail, name: fromName } = parseEmailAddress(fromRaw);

  return {
    from: fromEmail,
    from_name: fromName,
    to: getHeader(headers, "To").toLowerCase(),
    cc: getHeader(headers, "Cc").toLowerCase(),
    subject: getHeader(headers, "Subject") || "(sin asunto)",
    body: extractBody(msg.payload).slice(0, 10_000),
    message_id: getHeader(headers, "Message-ID") || null,
    in_reply_to: getHeader(headers, "In-Reply-To") || null,
    date: getHeader(headers, "Date") || new Date().toISOString(),
  };
}
