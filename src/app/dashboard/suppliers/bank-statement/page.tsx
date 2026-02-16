import { redirect } from "next/navigation";

export default function BankStatementRedirect() {
  redirect("/dashboard/finanzas/extracto");
}
