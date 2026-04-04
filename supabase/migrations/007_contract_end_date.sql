-- Track employee contract end dates for renewal alerts
ALTER TABLE user_profiles
ADD COLUMN IF NOT EXISTS contract_end_date DATE;
