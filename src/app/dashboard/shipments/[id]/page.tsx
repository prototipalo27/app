import { createClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import { ShipmentDetail } from "./shipment-detail";
import { getUserProfile, hasRole } from "@/lib/rbac";

export default async function ShipmentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const profile = await getUserProfile();
  const canDelete = profile ? hasRole(profile.role, "manager") : false;

  const supabase = await createClient();

  const { data: shipment } = await supabase
    .from("shipping_info")
    .select("*, projects(id, name)")
    .eq("id", id)
    .single();

  if (!shipment) notFound();

  // Fetch available projects for linking (those without a shipment)
  const { data: availableProjects } = await supabase
    .from("projects")
    .select("id, name")
    .order("created_at", { ascending: false });

  // Filter to projects that don't already have a shipment (or this shipment's project)
  const { data: linkedProjectIds } = await supabase
    .from("shipping_info")
    .select("project_id")
    .not("project_id", "is", null)
    .neq("id", id);

  const linkedIds = new Set(
    (linkedProjectIds ?? []).map((r) => r.project_id).filter(Boolean),
  );

  const unlinkableProjects = (availableProjects ?? []).filter(
    (p) => !linkedIds.has(p.id),
  );

  return (
    <ShipmentDetail
      shipment={shipment}
      linkedProject={shipment.projects as { id: string; name: string } | null}
      availableProjects={unlinkableProjects}
      canDelete={canDelete}
    />
  );
}
