// One-off: fill quote_requests.holded_proforma_doc_number for existing rows.
// Iterates over rows that have holded_proforma_id but no docNumber yet,
// fetches the proforma from Holded and saves the docNumber it returns.
//
// Usage: node scripts/backfill-proforma-doc-numbers.cjs
require("dotenv").config({ path: ".env.local" });
const { createClient } = require("@supabase/supabase-js");

const HOLDED_BASE = "https://api.holded.com/api/invoicing/v1";

async function fetchDocNumber(holdedId) {
  const res = await fetch(`${HOLDED_BASE}/documents/proform/${holdedId}`, {
    headers: { key: process.env.HOLDED_API_KEY },
  });
  if (!res.ok) throw new Error(`Holded ${res.status} ${res.statusText}`);
  const data = await res.json();
  return data.docNumber || null;
}

async function main() {
  if (!process.env.HOLDED_API_KEY) throw new Error("HOLDED_API_KEY not set");
  const sb = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  );

  const { data: rows, error } = await sb
    .from("quote_requests")
    .select("id, holded_proforma_id")
    .not("holded_proforma_id", "is", null)
    .is("holded_proforma_doc_number", null);
  if (error) throw error;
  console.log(`Backfilling ${rows.length} quote_requests`);

  let ok = 0;
  let fail = 0;
  for (const row of rows) {
    try {
      const docNumber = await fetchDocNumber(row.holded_proforma_id);
      if (!docNumber) {
        console.log(`  [skip] ${row.id} → Holded returned no docNumber`);
        continue;
      }
      const { error: upErr } = await sb
        .from("quote_requests")
        .update({ holded_proforma_doc_number: docNumber })
        .eq("id", row.id);
      if (upErr) throw upErr;
      console.log(`  [ok]   ${row.id} → ${docNumber}`);
      ok++;
      // Light delay to avoid hammering Holded.
      await new Promise((r) => setTimeout(r, 200));
    } catch (e) {
      console.log(`  [fail] ${row.id}: ${e.message}`);
      fail++;
    }
  }
  console.log(`Done. ok=${ok} fail=${fail}`);
}

main().catch((e) => {
  console.error("FAILED:", e);
  process.exit(1);
});
