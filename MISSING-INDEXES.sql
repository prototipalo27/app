-- ============================================================================
-- MISSING INDEXES — Prototipalo
-- Generated: 2026-04-15
-- Cross-referenced against existing pg_indexes. Only truly missing indexes.
-- DO NOT RUN ALL AT ONCE — test impact one by one in staging first.
-- ============================================================================

-- ── LEAD_ACTIVITIES (grows unbounded, heavy per-lead queries) ──────────────

-- Composite: lead_id + activity_type — used in email panel filtering
-- Files: crm/[id]/page.tsx:186, crm/actions.ts:1752 (getLeadEmails)
CREATE INDEX IF NOT EXISTS idx_lead_activities_lead_type
  ON lead_activities(lead_id, activity_type);

-- JSONB metadata fields — used for gmail thread dedup
-- Files: webhooks/gmail-push/route.ts:107, crm/actions.ts:1194
CREATE INDEX IF NOT EXISTS idx_lead_activities_gmail_message_id
  ON lead_activities ((metadata->>'message_id'))
  WHERE metadata->>'message_id' IS NOT NULL;

-- ── LEADS (200+ rows, filtered heavily in CRM) ───────────────────────────

-- updated_at — used in commission calculations with date ranges
-- Files: crm/actions.ts:2761-2768 (getMyCommissionData)
CREATE INDEX IF NOT EXISTS idx_leads_updated_at
  ON leads(updated_at DESC);

-- ── QUOTE_REQUESTS (per-lead lookups on every detail page) ────────────────

-- Composite: lead_id + created_at — every lead detail page orders by created_at
-- Files: crm/[id]/page.tsx:162,187,301, crm/actions.ts:1752
-- Note: idx_quote_requests_lead_id already exists (single column).
-- This composite replaces it for the common ordered query pattern.
CREATE INDEX IF NOT EXISTS idx_quote_requests_lead_created
  ON quote_requests(lead_id, created_at DESC);

-- ── SHIPPING_INFO ─────────────────────────────────────────────────────────

-- carrier — used for filtering shipments by carrier type
-- Files: shipments/page.tsx (list view), track/[token]/page.tsx:279
CREATE INDEX IF NOT EXISTS idx_shipping_info_carrier
  ON shipping_info(carrier)
  WHERE carrier IS NOT NULL;

-- packlink_shipment_ref — used for tracking lookups
-- Files: track/[token]/page.tsx:301, shipments/[id]/shipment-detail.tsx
CREATE INDEX IF NOT EXISTS idx_shipping_info_packlink_ref
  ON shipping_info(packlink_shipment_ref)
  WHERE packlink_shipment_ref IS NOT NULL;

-- ── PURCHASE_ITEMS ────────────────────────────────────────────────────────

-- created_at — used for date range filtering in purchases page
-- Files: purchases/page.tsx:14, finanzas/actions.ts
CREATE INDEX IF NOT EXISTS idx_purchase_items_created_at
  ON purchase_items(created_at DESC);

-- ── OVERTIME_ENTRIES ──────────────────────────────────────────────────────

-- user_id — used in equipo page to calculate overtime balances
-- Files: equipo/page.tsx:112, equipo/[id]/page.tsx
CREATE INDEX IF NOT EXISTS idx_overtime_entries_user_id
  ON overtime_entries(user_id);

-- ── TIME_OFF_REQUESTS ────────────────────────────────────────────────────

-- Composite: date range queries on equipo calendar
-- Files: equipo/page.tsx:130-134
CREATE INDEX IF NOT EXISTS idx_time_off_requests_dates
  ON time_off_requests(start_date, end_date);

-- ── HOLIDAYS ─────────────────────────────────────────────────────────────

-- year — filtered on every equipo page load
-- Files: equipo/page.tsx:128
-- Note: holidays.date has a unique index, but year is a separate column
CREATE INDEX IF NOT EXISTS idx_holidays_year
  ON holidays(year);

-- ── CLIENT_VERIFICATIONS (auth path for public tracking pages) ───────────

-- Composite: project_id + email — used in verification flow
-- Files: lib/client-auth.ts:136-143, api/track/verify/route.ts
-- Note: idx_client_verifications_project exists (single column).
-- This adds email for the common combined lookup.
CREATE INDEX IF NOT EXISTS idx_client_verifications_project_email
  ON client_verifications(project_id, email);

-- ── SUPPLIER_PAYMENTS ────────────────────────────────────────────────────

-- Composite: has_invoice + payment_date — monthly pending invoice reports
-- Files: suppliers/page.tsx:45-50 (monthPending query)
-- Note: idx_supplier_payments_pending exists (partial on has_invoice=false)
-- This adds payment_date for the range-filtered variant.
CREATE INDEX IF NOT EXISTS idx_supplier_payments_pending_date
  ON supplier_payments(payment_date)
  WHERE has_invoice = false;

-- ── WHATSAPP_MESSAGES ────────────────────────────────────────────────────

-- Already well-indexed: conversation_id+timestamp, whatsapp_message_id
-- No additional indexes needed.

-- ── TASKS ────────────────────────────────────────────────────────────────

-- Composite: assigned_to + status — used in cached getUserTaskCount
-- Files: lib/supabase/cached-queries.ts:63-67
CREATE INDEX IF NOT EXISTS idx_tasks_assigned_status
  ON tasks(assigned_to, status);

-- ============================================================================
-- NOTES:
-- - All PKs (id) are already indexed via PRIMARY KEY constraints
-- - Foreign keys like leads.assigned_to, leads.owned_by, projects.lead_id,
--   projects.project_manager_id already have indexes (added earlier this session)
-- - lead_utm_data.lead_id has a UNIQUE index (uq_lead_utm)
-- - commission_configs.user_id has a UNIQUE index
-- - nda_agreements.token and lead_id already have indexes
-- ============================================================================
