export const dynamic = "force-dynamic";

import { getUserProfile, hasRole } from "@/lib/rbac";
import { redirect } from "next/navigation";
import { getAllContactos, getTeamMembers } from "./actions";
import ContactosClient from "./contactos-client";

export default async function ContactosPage() {
  const profile = await getUserProfile();
  if (!profile || !profile.is_active) redirect("/login");
  if (!hasRole(profile.role, "manager")) redirect("/dashboard");

  const [contacts, team] = await Promise.all([getAllContactos(), getTeamMembers()]);

  return <ContactosClient initialContacts={contacts} teamMembers={team} />;
}
