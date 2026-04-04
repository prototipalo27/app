import Image from "next/image";
import { createServiceClient } from "@/lib/supabase/server";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import InvestorPortalClient from "./investor-portal-client";

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const supabase = createServiceClient();
  const { data: investor } = await supabase
    .from("investors")
    .select("full_name")
    .eq("access_token", token)
    .single();

  return {
    title: investor
      ? `${investor.full_name} — Prototipalo Inversores`
      : "Prototipalo Inversores",
  };
}

export default async function InvestorPortalPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const supabase = createServiceClient();

  // 1. Get investor by token
  const { data: investor } = await supabase
    .from("investors")
    .select("*")
    .eq("access_token", token)
    .eq("is_active", true)
    .single();

  if (!investor) notFound();

  // 2. Get all investors for cap table
  const { data: allInvestors } = await supabase
    .from("investors")
    .select("id, full_name, equity_pct, shares")
    .eq("is_active", true)
    .order("equity_pct", { ascending: false });

  // 3. Get published quarterly reports with clients
  const { data: reports } = await supabase
    .from("quarterly_reports")
    .select("*")
    .eq("published", true)
    .order("year", { ascending: false })
    .order("quarter", { ascending: false });

  // Get clients for each report
  const reportIds = (reports || []).map((r) => r.id);
  let reportClients: Record<string, unknown[]> = {};
  if (reportIds.length > 0) {
    const { data: clients } = await supabase
      .from("quarterly_report_clients")
      .select("*")
      .in("report_id", reportIds)
      .order("sort_order");

    if (clients) {
      for (const c of clients) {
        if (!reportClients[c.report_id]) reportClients[c.report_id] = [];
        reportClients[c.report_id].push(c);
      }
    }
  }

  // 4. Get team members
  const { data: team } = await supabase
    .from("user_profiles")
    .select("id, full_name, nickname, role")
    .eq("is_active", true)
    .order("full_name");

  // 5. Get printers
  const { data: printers } = await supabase
    .from("printers")
    .select("id, name, model, online, gcode_state, print_percent, remaining_minutes, current_file")
    .order("name");

  return (
    <div className="min-h-screen bg-zinc-50 dark:bg-black">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-4">
          <Image
            src="/logo-light.png"
            alt="Prototipalo"
            width={472}
            height={236}
            className="h-12 w-auto dark:hidden"
            priority
          />
          <Image
            src="/logo-dark.png"
            alt="Prototipalo"
            width={472}
            height={236}
            className="hidden h-12 w-auto dark:block"
            priority
          />
          <span className="rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
            Portal Inversor
          </span>
        </div>
      </header>

      <InvestorPortalClient
        investor={investor}
        allInvestors={allInvestors ?? []}
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
      reports={(reports ?? []).map((r) => ({ ...r, clients: reportClients[r.id] ?? [] })) as any}
        team={team ?? []}
        printers={printers ?? []}
      />
    </div>
  );
}
