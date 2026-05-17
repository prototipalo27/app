import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { createServiceClient } from "@/lib/supabase/server";

/**
 * Issues a one-time signed upload URL for the public Webflow lead form to
 * push files directly into Supabase Storage (`lead-attachments` bucket).
 *
 * Flow:
 *  1. Browser calls POST { filename, contentType, token? }.
 *  2. We return { signedUrl, path, token }. The browser PUTs the binary
 *     straight to Supabase using `signedUrl` — no proxying through us.
 *  3. The browser stuffs `token` into a hidden form field; on form submit,
 *     /api/crm/webhook reads `pending/{token}/*` and attaches the files
 *     to the lead it creates.
 *
 * No auth (it has to work for anonymous visitors), so the only escape
 * hatch against abuse is: signed URLs are scoped to a single path + short
 * expiry, and the bucket only accepts what `createSignedUploadUrl` allows.
 */

const MAX_FILENAME = 200;

function sanitizeFilename(raw: string): string {
  return raw
    .replace(/[/\\]/g, "_")        // strip path separators
    .replace(/[\x00-\x1f]/g, "")   // strip control chars
    .slice(0, MAX_FILENAME)
    .trim() || "file";
}

export async function POST(request: NextRequest) {
  let body: { filename?: string; contentType?: string; token?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.filename) {
    return NextResponse.json({ error: "filename required" }, { status: 400 });
  }

  const token = body.token && /^[a-f0-9-]{36}$/i.test(body.token)
    ? body.token
    : randomUUID();
  const path = `pending/${token}/${sanitizeFilename(body.filename)}`;

  const supabase = createServiceClient();
  const { data, error } = await supabase.storage
    .from("lead-attachments")
    .createSignedUploadUrl(path);

  if (error || !data) {
    console.error("[upload-url] createSignedUploadUrl failed:", error);
    return NextResponse.json({ error: "Failed to create upload URL" }, { status: 500 });
  }

  return NextResponse.json(
    {
      signedUrl: data.signedUrl,
      path: data.path,
      token,
    },
    {
      headers: {
        "Access-Control-Allow-Origin": "*",
      },
    },
  );
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "content-type",
      "Access-Control-Max-Age": "86400",
    },
  });
}
