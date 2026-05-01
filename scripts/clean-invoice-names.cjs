// One-off: clean ugly invoice filenames in a given Drive folder.
//
// Usage:
//   node scripts/clean-invoice-names.cjs <folderId>          # dry run
//   node scripts/clean-invoice-names.cjs <folderId> --apply  # actually rename

require("dotenv").config({ path: ".env.local" });
const { google } = require("googleapis");

function formatPrivateKey(raw) {
  let key = raw
    .replace(/^["']|["']$/g, "")
    .replace(/\\n/g, "\n")
    .replace(/-----BEGIN PRIVATE KEY-----/g, "")
    .replace(/-----END PRIVATE KEY-----/g, "")
    .replace(/\s/g, "");
  const lines = key.match(/.{1,64}/g) ?? [];
  return [
    "-----BEGIN PRIVATE KEY-----",
    ...lines,
    "-----END PRIVATE KEY-----",
    "",
  ].join("\n");
}

function getDrive() {
  const auth = new google.auth.JWT({
    email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
    key: formatPrivateKey(process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY),
    scopes: ["https://www.googleapis.com/auth/drive"],
  });
  return google.drive({ version: "v3", auth });
}

function slugifyCompany(name) {
  return name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]+/gu, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "");
}

// Strip trailing ext, trailing _<timestamp>, trailing _YYYY-MM, and trailing _<num>eur,
// returning { companyPart, total, dateSuffix, timestamp, ext }.
function parseFilename(name) {
  const dot = name.lastIndexOf(".");
  const ext = dot > 0 ? name.slice(dot + 1) : "";
  let stem = dot > 0 ? name.slice(0, dot) : name;

  let timestamp = null;
  const tsMatch = stem.match(/^(.*)_(\d{10,})$/);
  if (tsMatch) {
    stem = tsMatch[1];
    timestamp = tsMatch[2];
  }

  let dateSuffix = null;
  const dateMatch = stem.match(/^(.*)_(\d{4}-\d{2})$/);
  if (dateMatch) {
    stem = dateMatch[1];
    dateSuffix = dateMatch[2];
  }

  let total = null;
  // Accept dot or comma decimal separator inside the total
  const totalMatch = stem.match(/^(.*)_(\d+(?:[.,]\d+)?)eur$/);
  if (totalMatch) {
    stem = totalMatch[1];
    total = totalMatch[2].replace(",", ".");
  }

  return { companyPart: stem, total, dateSuffix, timestamp, ext };
}

// Given the dirty companyPart, recover a clean company string.
// Handles two shapes:
//   1. Normal: dashes/commas/dots — re-slugify after replacing dashes with spaces.
//   2. Embedded JSON: ```json-{companyXXXX,totalYYY,dateZZZ — extract company + total.
function recoverCompanyAndTotal(companyPart, fallbackTotal) {
  // Shape after the OCR JSON leaked into the slug:
  //   ```json-{company<NAME>,total<TOTAL>,date<DATE-TRUNC>
  // <NAME> may itself contain commas because the OCR sanitizer didn't strip them.
  const jsonWithTotal = companyPart.match(
    /^`{3}json-\{company(.+?),total([\d.,]+)(?:,date.*)?$/i,
  );
  if (jsonWithTotal) {
    const cleanCompany = slugifyCompany(jsonWithTotal[1].replace(/-/g, " "));
    const cleanTotal = jsonWithTotal[2].replace(",", ".");
    return { company: cleanCompany, total: cleanTotal };
  }
  const jsonNoTotal = companyPart.match(/^`{3}json-\{company(.+?)(?:,date.*)?$/i);
  if (jsonNoTotal) {
    const cleanCompany = slugifyCompany(jsonNoTotal[1].replace(/-/g, " "));
    return { company: cleanCompany, total: fallbackTotal };
  }

  const cleanCompany = slugifyCompany(companyPart.replace(/-/g, " "));
  return { company: cleanCompany, total: fallbackTotal };
}

function buildCleanName(name) {
  const { companyPart, total, dateSuffix, timestamp, ext } = parseFilename(name);
  if (!companyPart) return name;

  const { company, total: recoveredTotal } = recoverCompanyAndTotal(
    companyPart,
    total,
  );
  if (!company) return name;

  const totalSlug = recoveredTotal ? `_${recoveredTotal}eur` : "";
  const dateSlug = dateSuffix ? `_${dateSuffix}` : "";
  const tsSlug = timestamp ? `_${timestamp}` : "";
  const extSlug = ext ? `.${ext}` : "";
  return `${company}${totalSlug}${dateSlug}${tsSlug}${extSlug}`;
}

async function listFolder(drive, folderId) {
  const files = [];
  let pageToken;
  do {
    const res = await drive.files.list({
      supportsAllDrives: true,
      includeItemsFromAllDrives: true,
      q: `'${folderId}' in parents and trashed = false`,
      fields: "nextPageToken, files(id, name, mimeType)",
      pageSize: 200,
      pageToken,
    });
    for (const f of res.data.files ?? []) files.push(f);
    pageToken = res.data.nextPageToken;
  } while (pageToken);
  return files;
}

async function main() {
  const folderId = process.argv[2];
  const apply = process.argv.includes("--apply");

  if (!folderId) {
    console.error("Usage: node scripts/clean-invoice-names.cjs <folderId> [--apply]");
    process.exit(1);
  }

  const drive = getDrive();
  const files = await listFolder(drive, folderId);
  console.log(`Found ${files.length} entries in folder.`);

  const renames = [];
  for (const f of files) {
    if (f.mimeType === "application/vnd.google-apps.folder") continue;
    const cleaned = buildCleanName(f.name);
    if (cleaned !== f.name) renames.push({ id: f.id, before: f.name, after: cleaned });
  }

  console.log(`\nProposing ${renames.length} renames:`);
  for (const r of renames) {
    console.log(`  - ${r.before}`);
    console.log(`    → ${r.after}`);
  }

  if (!apply) {
    console.log("\nDry run. Re-run with --apply to actually rename.");
    return;
  }

  console.log("\nApplying renames...");
  for (const r of renames) {
    await drive.files.update({
      fileId: r.id,
      supportsAllDrives: true,
      requestBody: { name: r.after },
    });
    console.log(`  ✓ ${r.after}`);
  }
  console.log("Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
