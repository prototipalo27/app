import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { generateNdaPdf } from "@/lib/nda-pdf";

export async function GET(req: NextRequest) {
  await requireRole("super_admin");

  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

  const sb = createServiceClient();
  const { data, error } = await sb
    .from("nda_agreements")
    .select("signer_name, signer_company, signer_nif, signer_address, signature_data, signed_at, status")
    .eq("id", id)
    .single();

  if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
  if (data.status !== "signed") return NextResponse.json({ error: "not signed" }, { status: 400 });

  const buf = await generateNdaPdf({
    signerName: data.signer_name,
    signerCompany: data.signer_company,
    signerNif: data.signer_nif,
    signerAddress: data.signer_address,
    signatureData: data.signature_data,
    signedAt: new Date(data.signed_at),
  });

  return new NextResponse(buf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="NDA-${data.signer_name.replace(/\s+/g, "-")}.pdf"`,
    },
  });
}
