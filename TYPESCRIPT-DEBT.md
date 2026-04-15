# TypeScript Debt — Prototipalo

## Summary
- **27** `as any` instances
- **35** `as unknown` double-casts
- **0** `@ts-ignore` / `@ts-expect-error`
- **3** duplicate type definitions

---

## `as any` Instances

### Supabase commission_configs (8 instances — highest priority)
The `commission_configs` table is not in the generated Supabase types.

| File | Line | Fix |
|------|------|-----|
| `src/app/dashboard/crm/actions.ts` | 588 | Regenerate types or add `commission_configs` to `database.types.ts` |
| `src/app/dashboard/crm/actions.ts` | 609 | Same |
| `src/app/dashboard/crm/actions.ts` | 738 | Same |
| `src/app/dashboard/crm/actions.ts` | 2583 | Same |
| `src/app/dashboard/crm/actions.ts` | 2632 | Same |
| `src/app/dashboard/crm/actions.ts` | 2747 | Same |
| `src/app/dashboard/crm/actions.ts` | 2792 | Same |
| `src/app/dashboard/crm/actions.ts` | 3261 | `quote_requests.cc_emails` field missing from types |

**Root cause**: Run `npx supabase gen types` to regenerate types including `commission_configs` and `cc_emails` field.

### Supabase app_state / holded_contacts_excluded (5 instances)

| File | Line | Why |
|------|------|-----|
| `src/app/api/webhooks/gmail-push/route.ts` | 42, 52, 242 | `app_state` table not in types |
| `src/lib/holded/cache.ts` | 16 | `holded_contacts_excluded` not in types |
| `src/app/dashboard/contactos/actions.ts` | 201 | Same |

**Fix**: Regenerate Supabase types.

### Supabase user_profiles extra fields (2 instances)

| File | Line | Why |
|------|------|-----|
| `src/app/dashboard/equipo/page.tsx` | 139 | `phone`, `contract_end_date` not in generated types |
| `src/app/dashboard/equipo/page.tsx` | 153 | Same, admin section |

**Fix**: Regenerate Supabase types after adding `contract_end_date` column.

### External libraries (2 instances)

| File | Line | Why | Fix |
|------|------|-----|-----|
| `src/app/nda/[token]/actions.ts` | 137 | pdfMake lacks types | Install `@types/pdfmake` |
| `src/app/nda/[token]/actions.ts` | 139 | pdfFonts lacks types | Same |

### Investor/component props (5 instances)

| File | Line | Why |
|------|------|-----|
| `src/app/investors/[token]/page.tsx` | 149, 150, 152 | Supabase response shape doesn't match component props |
| `src/app/dashboard/inversores/page.tsx` | 19, 20 | Same |

**Fix**: Create shared `Investor` and `Report` interfaces in `src/app/dashboard/inversores/types.ts`.

### Other (5 instances)

| File | Line | Why |
|------|------|-----|
| `src/app/api/emails/send-scheduled/route.ts` | 12, 33 | `scheduled_emails` table not in types |
| `src/app/dashboard/crm/[id]/lead-actions.tsx` | 613 | `cc_emails` field missing from quote_requests type |
| `src/app/dashboard/crm/actions.ts` | 3241 | Same |
| `src/app/api/crm/webhook/route.ts` | 115 | String literal type check against tuple |

---

## `as unknown` Double-Casts (35 instances)

### Pattern 1: JSON column → typed array (18 instances)
The `quote_requests.items` column is stored as JSON but used as `ProformaLineItem[]`.

```typescript
// Current (repeated 18 times across crm/actions.ts, quote/actions.ts, comisiones/page.tsx)
const items = (qr.items || []) as unknown as ProformaLineItem[];
```

**Fix**: Create a typed helper:
```typescript
// src/lib/supabase/json-helpers.ts
import type { Json } from "./database.types";
export function parseProformaItems(items: Json): ProformaLineItem[] {
  return (items || []) as ProformaLineItem[];
}
```

### Pattern 2: BankTransaction JSON (6 instances)
`bank_statements.transactions` stored as JSON, cast to `BankTransaction[]`.

**Files**: `finanzas/page.tsx`, `finanzas/extracto/statement-processor.tsx`, `suppliers/bank-statement/statement-processor.tsx`, `api/finance/report/route.ts`

**Fix**: Same helper pattern as above.

### Pattern 3: Supabase relation unpacking (5 instances)
```typescript
const proj = i.projects as unknown as { name: string; queue_priority: number } | null;
```

**Files**: `printers/page.tsx:64`, `printers/printer-grid.tsx:110`, `queue/page.tsx:58`

**Fix**: Create shared type:
```typescript
// src/types/relations.ts
export type ProjectReference = { name: string; queue_priority: number };
```

---

## Duplicate Type Definitions

### 1. `QuoteItem` — 3 identical definitions

| File | Line |
|------|------|
| `src/app/quote/[token]/page.tsx` | 12 |
| `src/app/quote/[token]/actions.ts` | 28 |
| `src/app/quote/[token]/quote-form.tsx` | 7 |

**Fix**: Create `src/app/quote/types.ts` with shared export.

### 2. `StatementSummary` — 2 slightly different definitions

| File | Difference |
|------|-----------|
| `src/app/dashboard/finanzas/extracto/statement-processor.tsx` | Has optional `id`, extra `checked_vendors` |
| `src/app/dashboard/suppliers/bank-statement/statement-processor.tsx` | Has required `id` |

**Fix**: Create `src/lib/statement-types.ts` with base + extended interface.

### 3. `BankTx` — 2 inline definitions + 1 proper export

| File | Shape |
|------|-------|
| `src/lib/bbva-parser.ts` | Full `BankTransaction` (exported) |
| `src/app/dashboard/finanzas/page.tsx` | Inline `{ vendorName?: string; amount: number }` |
| `src/app/api/finance/report/route.ts` | Inline `{ vendorName?: string; amount: number; description?: string }` |

**Fix**: Use `Pick<BankTransaction, 'vendorName' | 'amount'>` from bbva-parser.

---

## Recommended Priority

1. **Regenerate Supabase types** — fixes 15 of 27 `as any` instances in one command
2. **Create JSON column helpers** — fixes 18 of 35 `as unknown` instances
3. **Consolidate QuoteItem** — eliminates 3 duplicate definitions
4. **Install @types/pdfmake** — fixes 2 external library casts
