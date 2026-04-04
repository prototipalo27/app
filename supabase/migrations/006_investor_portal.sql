-- Investor portal: access tokens + video URL
ALTER TABLE investors ADD COLUMN IF NOT EXISTS access_token TEXT UNIQUE;
ALTER TABLE quarterly_reports ADD COLUMN IF NOT EXISTS video_url TEXT;
ALTER TABLE quarterly_reports ADD COLUMN IF NOT EXISTS published BOOLEAN NOT NULL DEFAULT FALSE;

-- Generate tokens for existing investors
UPDATE investors SET access_token = encode(gen_random_bytes(24), 'hex') WHERE access_token IS NULL;

-- Index for token lookup
CREATE INDEX IF NOT EXISTS idx_investors_token ON investors(access_token) WHERE access_token IS NOT NULL;

-- Allow public read of investors by token (no auth needed)
CREATE POLICY "Public read investor by token"
  ON investors FOR SELECT
  USING (access_token IS NOT NULL);

-- Allow public read of quarterly reports that are published
CREATE POLICY "Public read published reports"
  ON quarterly_reports FOR SELECT
  USING (published = TRUE);

-- Allow public read of report clients for published reports
CREATE POLICY "Public read report clients for published reports"
  ON quarterly_report_clients FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quarterly_reports
      WHERE quarterly_reports.id = quarterly_report_clients.report_id
      AND quarterly_reports.published = TRUE
    )
  );
