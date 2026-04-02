-- Additional email recipients for quote/proforma communications
-- Stores array of { email, label } objects (e.g. purchasing dept, billing dept)
ALTER TABLE quote_requests
ADD COLUMN IF NOT EXISTS cc_emails JSONB DEFAULT '[]'::jsonb;
