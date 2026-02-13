import { ImapFlow } from "imapflow";
import { simpleParser, type Source } from "mailparser";

export interface ParsedEmail {
  uid: number;
  messageId: string | null;
  inReplyTo: string | null;
  from: string;
  fromName: string;
  to: string;
  subject: string;
  body: string;
  date: Date;
}

export async function fetchNewEmails(
  sinceUid: number,
  maxResults = 50
): Promise<ParsedEmail[]> {
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!user || !pass) {
    throw new Error("SMTP_USER and SMTP_PASS must be configured");
  }

  const client = new ImapFlow({
    host: "imap.gmail.com",
    port: 993,
    secure: true,
    auth: { user, pass },
    logger: false,
  });

  const emails: ParsedEmail[] = [];

  try {
    await client.connect();

    const lock = await client.getMailboxLock("INBOX");
    try {
      const searchQuery = sinceUid > 0 ? `${sinceUid + 1}:*` : "1:*";

      for await (const message of client.fetch(searchQuery, {
        uid: true,
        envelope: true,
        source: true,
      })) {
        if (message.uid <= sinceUid) continue;

        const envelope = message.envelope;
        if (!envelope) continue;

        const fromAddress =
          envelope.from?.[0]?.address?.toLowerCase() || "";
        if (fromAddress === user.toLowerCase()) continue;

        if (!message.source) continue;

        const parsed = await simpleParser(message.source as Source);

        const body = (parsed.text || "").slice(0, 10_000);
        const inReplyTo = parsed.inReplyTo as string | string[] | undefined;

        emails.push({
          uid: message.uid,
          messageId: parsed.messageId || null,
          inReplyTo:
            (Array.isArray(inReplyTo) ? inReplyTo[0] : inReplyTo) || null,
          from: fromAddress,
          fromName: envelope.from?.[0]?.name || fromAddress,
          to: envelope.to?.[0]?.address || "",
          subject: envelope.subject || "(sin asunto)",
          body,
          date: envelope.date || new Date(),
        });

        if (emails.length >= maxResults) break;
      }
    } finally {
      lock.release();
    }
  } finally {
    await client.logout().catch(() => {});
  }

  return emails;
}
