import { createClient } from "@/lib/supabase/server";
import PurchaseList from "./purchase-list";

export default async function PurchasesPage() {
  const supabase = await createClient();

  const { data: items } = await supabase
    .from("purchase_items")
    .select("*")
    .order("created_at", { ascending: true });

  return <PurchaseList items={items || []} />;
}
