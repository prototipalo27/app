-- Investors zone: equity tracking + quarterly reports
-- Run this migration in the Supabase SQL editor

-- 1. Investors table
CREATE TABLE IF NOT EXISTS investors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  full_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  equity_pct NUMERIC(6,3) NOT NULL DEFAULT 0,  -- e.g. 25.500 = 25.5%
  invested_amount NUMERIC(12,2) DEFAULT 0,      -- total € invested
  shares INTEGER NOT NULL DEFAULT 0,            -- participaciones
  share_number_from INTEGER,                    -- numeración desde
  share_number_to INTEGER,                      -- numeración hasta
  nominal_value NUMERIC(12,2) DEFAULT 0,        -- valor nominal por participación
  premium_total NUMERIC(12,2) DEFAULT 0,        -- prima total
  premium_per_share NUMERIC(16,8) DEFAULT 0,    -- prima por participación
  join_date DATE,
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 2. Quarterly reports table
CREATE TABLE IF NOT EXISTS quarterly_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  quarter INTEGER NOT NULL CHECK (quarter BETWEEN 1 AND 4),  -- Q1, Q2, Q3, Q4
  year INTEGER NOT NULL,
  -- Financial metrics
  revenue NUMERIC(12,2) DEFAULT 0,          -- Facturación
  expenses NUMERIC(12,2) DEFAULT 0,         -- Gastos
  net_profit NUMERIC(12,2) DEFAULT 0,       -- Beneficio neto
  cash_balance NUMERIC(12,2) DEFAULT 0,     -- Saldo en caja
  -- Operational metrics
  projects_completed INTEGER DEFAULT 0,
  new_clients INTEGER DEFAULT 0,
  -- Summary
  summary TEXT,                              -- Resumen en texto libre
  highlights TEXT,                           -- Hitos destacados
  challenges TEXT,                           -- Retos / problemas
  next_quarter_goals TEXT,                   -- Objetivos próximo trimestre
  -- Meta
  created_by UUID REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (quarter, year)
);

-- Seed investors data
INSERT INTO investors (full_name, equity_pct, shares, share_number_from, share_number_to, invested_amount, nominal_value, premium_total, premium_per_share) VALUES
  ('Manuel de la Viña de Vargas', 92.11,  3000, 1,    3000, 0,    0,  0,    0),
  ('Emilio de la Viña Macias',     1.54,    50, 3001, 3050, 0,    0,  0,    0),
  ('Lourdes de la Viña Vargas',    1.23,    40, 3051, 3090, 0,    0,  0,    0),
  ('Manuel de la Viña Gomez',      1.96,    64, 3091, 3154, 3600, 24, 3576, 149),
  ('Pedro Ureta Moraleda',         0.40,    13, 3155, 3167, 0,    0,  0,    0),
  ('Luis Gonzalez Arias',          1.54,    50, 3168, 3217, 0,    0,  0,    0),
  ('Enrique Miguel Merino Ramonell', 1.23,  40, 3218, 3257, 6000, 40, 5960, 149)
ON CONFLICT DO NOTHING;

-- RLS
ALTER TABLE investors ENABLE ROW LEVEL SECURITY;
ALTER TABLE quarterly_reports ENABLE ROW LEVEL SECURITY;

-- Only super_admin can manage investors
CREATE POLICY "Super admin full access investors"
  ON investors FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "Service role full access investors"
  ON investors FOR ALL
  USING (auth.role() = 'service_role');

-- Only super_admin can manage quarterly reports
CREATE POLICY "Super admin full access quarterly reports"
  ON quarterly_reports FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM user_profiles
      WHERE id = auth.uid()
      AND role = 'super_admin'
      AND is_active = true
    )
  );

CREATE POLICY "Service role full access quarterly reports"
  ON quarterly_reports FOR ALL
  USING (auth.role() = 'service_role');
