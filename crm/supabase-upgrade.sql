-- ══════════════════════════════════════════════
-- Montana CRM — Schema Upgrade
-- Run this in Supabase → SQL Editor
-- ══════════════════════════════════════════════

-- 1. Visit fields: AM/PM + Visit Type
ALTER TABLE crm_visits
  ADD COLUMN IF NOT EXISTS time_of_day  TEXT DEFAULT 'AM',
  ADD COLUMN IF NOT EXISTS visit_type   TEXT DEFAULT 'regular';

-- 2. Doctor type (Pharmacy / Doctor / Polyclinic / Hospital)
ALTER TABLE crm_doctors
  ADD COLUMN IF NOT EXISTS doctor_type  TEXT DEFAULT 'doctor';

-- 3. Day logs table
CREATE TABLE IF NOT EXISTS crm_day_logs (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id     UUID REFERENCES crm_reps(id) ON DELETE CASCADE,
  log_date   DATE NOT NULL DEFAULT CURRENT_DATE,
  day_type   TEXT NOT NULL,
  notes      TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(rep_id, log_date)
);

ALTER TABLE crm_day_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rep_see_own_daylogs" ON crm_day_logs
  FOR SELECT USING (
    rep_id = (SELECT id FROM crm_reps WHERE user_id = auth.uid())
  );

CREATE POLICY "rep_insert_daylogs" ON crm_day_logs
  FOR INSERT WITH CHECK (
    rep_id = (SELECT id FROM crm_reps WHERE user_id = auth.uid())
  );

CREATE POLICY "rep_update_daylogs" ON crm_day_logs
  FOR UPDATE USING (
    rep_id = (SELECT id FROM crm_reps WHERE user_id = auth.uid())
  );

CREATE POLICY "admin_all_daylogs" ON crm_day_logs
  FOR ALL USING (is_crm_admin());
