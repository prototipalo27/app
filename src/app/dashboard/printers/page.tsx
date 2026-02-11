import { createClient } from "@/lib/supabase/server";
import PrinterGrid from "./printer-grid";

export const metadata = {
  title: "Printers - Prototipalo",
};

export default async function PrintersPage() {
  const supabase = await createClient();

  const { data: printers } = await supabase
    .from("printers")
    .select("*")
    .order("name");

  return (
    <div>
      <h1 className="mb-6 text-2xl font-bold text-zinc-900 dark:text-white">
        Printers
      </h1>
      <PrinterGrid initialPrinters={printers ?? []} />
    </div>
  );
}
