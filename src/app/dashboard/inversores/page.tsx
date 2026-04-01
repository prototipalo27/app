import { requireRole } from "@/lib/rbac";
import { getInvestors, getQuarterlyReports } from "./actions";
import InvestorsClient from "./investors-client";

export const metadata = {
  title: "Inversores - Prototipalo",
};

export default async function InversoresPage() {
  await requireRole("super_admin");

  const [investorsResult, reportsResult] = await Promise.all([
    getInvestors(),
    getQuarterlyReports(),
  ]);

  return (
    <InvestorsClient
      investors={investorsResult.data ?? []}
      reports={reportsResult.data ?? []}
    />
  );
}
