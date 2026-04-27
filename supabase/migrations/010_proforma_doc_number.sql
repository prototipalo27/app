-- Track Holded's human-readable proforma docNumber on each quote request.
-- This is the code (e.g. PRO260075) that clients see on their proforma and
-- that we can match against bank-transfer "concepto" lines for reconciliation.

ALTER TABLE quote_requests
  ADD COLUMN IF NOT EXISTS holded_proforma_doc_number TEXT;

CREATE INDEX IF NOT EXISTS idx_quote_requests_proforma_doc_number
  ON quote_requests (holded_proforma_doc_number)
  WHERE holded_proforma_doc_number IS NOT NULL;
