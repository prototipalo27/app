import { NextRequest, NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/rbac";
import { generateDevAgreementPdf } from "@/lib/studio-dev-agreement-pdf";
import { getPrototipaloSignature } from "@/lib/prototipalo-signature";
import type { AgreementLanguage } from "@/lib/studio-dev-agreement-text";

// `studio_dev_agreements` aún no está en database.types.ts (la regeneración
// la lleva el equipo manualmente). Tipamos el row a mano para que tsc no se
// queje y para que el resto del fichero quede chequeado.
interface DevAgreementRow {
  id: string;
  status: "pending" | "signed" | "cancelled";
  language: AgreementLanguage;
  signer_name: string | null;
  signer_company: string | null;
  signer_nif: string | null;
  signer_address: string | null;
  signer_position: string | null;
  signature_data: string | null;
  signed_at: string | null;
  nda_reference_date: string | null;
  workspace_fee: number | string;
  engineering_hours: number;
  engineering_rate: number | string;
  printing_hours: number;
  printing_rate: number | string;
  minimum_months: number;
  approval_threshold: number | string;
  studio_projects: { nda_project_description: string | null } | null;
}

export async function GET(req: NextRequest) {
  try {
    await requireRole("manager");

    const id = req.nextUrl.searchParams.get("id");
    if (!id) return NextResponse.json({ error: "missing id" }, { status: 400 });

    const sb = createServiceClient();
    // Cast a `any` puntual para esquivar las firmas de Supabase generadas — la
    // tabla `studio_dev_agreements` no está en database.types.ts todavía.
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rawData, error } = await (sb as unknown as { from: (t: string) => any })
      .from("studio_dev_agreements")
      .select("*, studio_projects(nda_project_description)")
      .eq("id", id)
      .single();

    if (error || !rawData) return NextResponse.json({ error: "not found" }, { status: 404 });
    const data = rawData as DevAgreementRow;
    if (data.status !== "signed") return NextResponse.json({ error: "not signed" }, { status: 400 });
    if (!data.signer_name || !data.signature_data || !data.signed_at) {
      return NextResponse.json({ error: "missing signer data" }, { status: 400 });
    }

    const project = data.studio_projects;
    const companySignatureData = await getPrototipaloSignature();

    const buf = await generateDevAgreementPdf({
      language: data.language,
      terms: {
        workspaceFee: Number(data.workspace_fee),
        engineeringHours: data.engineering_hours,
        engineeringRate: Number(data.engineering_rate),
        printingHours: data.printing_hours,
        printingRate: Number(data.printing_rate),
        minimumMonths: data.minimum_months,
        approvalThreshold: Number(data.approval_threshold),
      },
      signerName: data.signer_name,
      signerCompany: data.signer_company ?? "",
      signerNif: data.signer_nif ?? "",
      signerAddress: data.signer_address ?? "",
      signerPosition: data.signer_position ?? undefined,
      signatureData: data.signature_data,
      signedAt: new Date(data.signed_at),
      ndaReferenceDate: data.nda_reference_date ? new Date(data.nda_reference_date) : null,
      projectDescription: project?.nda_project_description ?? null,
      companySignatureData,
    });

    const filename = data.language === "es"
      ? `Contrato-Desarrollo-${data.signer_name.replace(/\s+/g, "-")}.pdf`
      : `Development-Agreement-${data.signer_name.replace(/\s+/g, "-")}.pdf`;

    return new NextResponse(new Uint8Array(buf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${filename}"`,
      },
    });
  } catch (e) {
    console.error("[regen-contract] failed:", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "internal error" },
      { status: 500 },
    );
  }
}
