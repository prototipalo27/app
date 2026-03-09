import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import ContactosClient from "./contactos-client";

export default async function ContactosPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  return <ContactosClient />;
}
