-- Quarterly report expenses breakdown by category (from bank statements)
CREATE TABLE quarterly_report_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  report_id UUID NOT NULL REFERENCES quarterly_reports(id) ON DELETE CASCADE,
  category TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  vendor_count INTEGER NOT NULL DEFAULT 0,
  details JSONB DEFAULT '[]',
  sort_order INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(report_id, category)
);

ALTER TABLE quarterly_report_expenses ENABLE ROW LEVEL SECURITY;

-- Admin full access
CREATE POLICY "Super admin full access expenses"
  ON quarterly_report_expenses FOR ALL
  USING (
    EXISTS (SELECT 1 FROM user_profiles WHERE id = auth.uid() AND role = 'super_admin')
  );

-- Public read for published reports
CREATE POLICY "Public read expenses for published reports"
  ON quarterly_report_expenses FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM quarterly_reports
      WHERE quarterly_reports.id = quarterly_report_expenses.report_id
      AND quarterly_reports.published = TRUE
    )
  );
