-- Add dedicated won_at timestamp to leads
ALTER TABLE leads ADD COLUMN IF NOT EXISTS won_at TIMESTAMPTZ;

-- Backfill: set won_at = updated_at for already won/paid leads
UPDATE leads SET won_at = updated_at WHERE status IN ('won', 'paid') AND won_at IS NULL;

-- Index for quarter queries
CREATE INDEX IF NOT EXISTS idx_leads_won_at ON leads(won_at) WHERE won_at IS NOT NULL;
