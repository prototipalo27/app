-- Editable client data per quarterly report
CREATE TABLE IF NOT EXISTS quarterly_report_clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES quarterly_reports(id) ON DELETE CASCADE,
  client_name TEXT NOT NULL,
  client_email TEXT,
  source TEXT DEFAULT 'directo',
  is_recurring BOOLEAN DEFAULT FALSE,
  quarter_value NUMERIC(12,2) DEFAULT 0,
  lifetime_value NUMERIC(12,2) DEFAULT 0,
  projects JSONB DEFAULT '[]',  -- [{name, description, value}]
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_qrc_report ON quarterly_report_clients(report_id);

ALTER TABLE quarterly_report_clients ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Super admin full access qrc"
  ON quarterly_report_clients FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid() AND role = 'super_admin' AND is_active = true
    )
  );

CREATE POLICY "Service role full access qrc"
  ON quarterly_report_clients FOR ALL
  USING (auth.role() = 'service_role');
