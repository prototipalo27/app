import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { generateNdaPdf } from "@/lib/nda-pdf";
import { generateStudioNdaPdf } from "@/lib/studio-nda-pdf";
import { getPrototipaloSignature } from "@/lib/prototipalo-signature";

export async function GET(req: NextRequest) {
  try {
    await requireRole("manager");

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const sb = createServiceClient();
    const { data, error } = await sb
      .from("nda_agreements")
      .select(
        "signer_name, signer_company, signer_nif, signer_address, signer_position, signature_data, signed_at, status, studio_project_id, studio_projects(nda_project_description)",
      )
      .eq("id", id)
      .single();

    if (error || !data) return NextResponse.json({ error: "not found" }, { status: 404 });
    if (data.status !== "signed") return NextResponse.json({ error: "not signed" }, { status: 400 });
    if (!data.signer_name || !data.signature_data || !data.signed_at) {
      return NextResponse.json({ error: "missing signer data" }, { status: 400 });
    }

    const isStudio = !!data.studio_project_id;
    const studioRel = data.studio_projects as { nda_project_description: string | null } | null;
    const companySignatureData = await getPrototipaloSignature();

    const buf = isStudio
      ? await generateStudioNdaPdf({
          signerName: data.signer_name,
          signerCompany: data.signer_company ?? "",
          signerNif: data.signer_nif ?? "",
          signerAddress: data.signer_address ?? "",
          signerPosition: data.signer_position ?? undefined,
          signatureData: data.signature_data,
          signedAt: new Date(data.signed_at),
          projectDescription: studioRel?.nda_project_description ?? null,
          companySignatureData,
        })
      : await generateNdaPdf({
          signerName: data.signer_name,
          signerCompany: data.signer_company ?? "",
          signerNif: data.signer_nif ?? "",
          signerAddress: data.signer_address ?? "",
          signatureData: data.signature_data,
          signedAt: new Date(data.signed_at),
          companySignatureData,
        });

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${isStudio ? "Mutual-NDA" : "NDA"}-${data.signer_name.replace(/\s+/g, "-")}.pdf"`,
      },
    });
  } catch (e) {
    console.error("[regen-nda] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}
