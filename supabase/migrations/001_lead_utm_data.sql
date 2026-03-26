-- Migration: Create lead_utm_data table for UTM tracking
-- Run this in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS lead_utm_data (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL REFERENCES leads(id) ON DELETE CASCADE,

  -- Standard UTM parameters
  utm_source TEXT,
  utm_medium TEXT,
  utm_campaign TEXT,
  utm_term TEXT,
  utm_content TEXT,

  -- Click IDs from ad platforms
  gclid TEXT,
  fbclid TEXT,
  msclkid TEXT,
  ttclid TEXT,

  -- Page / referrer context
  referrer TEXT,
  landing_page TEXT,
  current_page TEXT,

  -- Attribution touches
  first_touch_page TEXT,
  first_touch_referrer TEXT,
  first_touch_timestamp TIMESTAMPTZ,
  last_touch_timestamp TIMESTAMPTZ,

  -- Session
  session_id TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT uq_lead_utm UNIQUE (lead_id)
);

-- Indexes for analytics queries
CREATE INDEX IF NOT EXISTS idx_lead_utm_source ON lead_utm_data(utm_source);
CREATE INDEX IF NOT EXISTS idx_lead_utm_medium ON lead_utm_data(utm_medium);
CREATE INDEX IF NOT EXISTS idx_lead_utm_campaign ON lead_utm_data(utm_campaign);
CREATE INDEX IF NOT EXISTS idx_lead_utm_created ON lead_utm_data(created_at);

-- RLS
ALTER TABLE lead_utm_data ENABLE ROW LEVEL SECURITY;

-- Authenticated users can read
CREATE POLICY "Authenticated users can read UTM data"
  ON lead_utm_data FOR SELECT
  TO authenticated
  USING (true);

-- Service role has full access (webhook uses service role key)
CREATE POLICY "Service role full access on UTM data"
  ON lead_utm_data FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);
