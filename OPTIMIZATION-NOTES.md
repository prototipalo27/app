# Optimization Notes

## select("*") decisions

### Kept as select("*") — low risk, low reward:
- `cached-queries.ts:137` — `leads` in `getCachedLeadsWithActivity()`: Result is cacheado ("use cache", cacheLife("minutes")). Reducing columns requires changing `LeadWithAssignee = Tables<"leads">` type used in crm-card.tsx, crm-kanban.tsx, and wrapper. Breaking change for ~50KB savings every 5 minutes. Not worth the risk.
- `projects/[id]/page.tsx:73` — single project detail: Uses ~25 of 30 columns. Single row. Trivial payload.
- `projects/[id]/page.tsx:91,96,100` — project_items, printer_types, shipping_info: Small per-project result sets, used extensively in child components. Reducing columns would be fragile.
- `crm/[id]/page.tsx:354` — single lead detail: Uses ~22 of 30 columns. Single row.
- `crm/[id]/page.tsx:162,186,214,301` — quote_requests, lead_activities in Suspense sections: Per-lead queries, already streaming via Suspense.
- Settings pages (templates, snippets): Tiny tables (<50 rows), admin-only pages.

### Already optimized:
- `crm/list/page.tsx:95` — reduced to 10 specific fields (was select("*"))
- `suppliers/page.tsx:12` — reduced to 5 specific fields (was select("*"))

## API routes vs Server Actions

### Kept as API routes — valid reasons:
- `/api/printers/sync` — Called by service worker polling (setInterval), not a form action
- `/api/track/verify` — Public route called from client-portal.tsx (unauthenticated, uses session tokens)
- `/api/track/approve` — Public route, same auth model as verify
- `/api/holded/contacts` — Used for debounced search autocomplete with AbortController
- `/api/notifications/subscribe` — Receives PushSubscription JSON from browser Push API

Server Actions are for mutations triggered by user actions in authenticated pages. These routes serve different patterns (polling, public access, browser APIs).

## Webhook consolidation

The webhook handlers for email-received, gmail-push, whatsapp, and crm/webhook have distinct payload schemas and processing logic. Consolidating them into a shared module would create coupling between unrelated features. Each handler should remain independent.

## Stripe logic

The Stripe integration points (quote checkout, payment success, payment cancel) are thin wrappers around `stripe.checkout.sessions.create()` with different line items per context. The shared code is ~5 lines. Not worth extracting.
