-- ============================================================
-- Stepscale Sales KPI Dashboard Schema
-- Run this in Supabase SQL editor (Dashboard > SQL Editor)
-- ============================================================

-- Reps (sales reps)
CREATE TABLE IF NOT EXISTS reps (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  initials    VARCHAR(4) NOT NULL,
  color       VARCHAR(12) NOT NULL,
  joined_date DATE,
  role        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Clients
CREATE TABLE IF NOT EXISTS clients (
  id          TEXT PRIMARY KEY DEFAULT 'c' || floor(extract(epoch from now()) * 1000)::text,
  name        TEXT NOT NULL,
  plan        TEXT NOT NULL CHECK (plan IN ('Starter', 'Growth', 'Scale')),
  mrr         INTEGER NOT NULL DEFAULT 0,
  since_date  DATE NOT NULL DEFAULT CURRENT_DATE,
  owner_id    TEXT NOT NULL REFERENCES reps(id),
  status      TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'trial')),
  created_at  TIMESTAMPTZ DEFAULT NOW()
);

-- Historical daily activity per rep (one row per rep per day)
CREATE TABLE IF NOT EXISTS activity_daily (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id  TEXT NOT NULL REFERENCES reps(id),
  date    DATE NOT NULL,
  dials   INTEGER NOT NULL DEFAULT 0,
  conv    INTEGER NOT NULL DEFAULT 0,
  vm      INTEGER NOT NULL DEFAULT 0,
  disc    INTEGER NOT NULL DEFAULT 0,
  demo    INTEGER NOT NULL DEFAULT 0,
  onb     INTEGER NOT NULL DEFAULT 0,
  closed  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (rep_id, date)
);
CREATE INDEX IF NOT EXISTS idx_activity_daily_rep_date ON activity_daily (rep_id, date);
CREATE INDEX IF NOT EXISTS idx_activity_daily_date ON activity_daily (date);

-- Individual live log entries (feed + today's counts)
-- metric_key: dials | conv | vm | disc | demo | onb |
--             disc_att | demo_att | disc_resch | demo_resch | ghosted | closed
CREATE TABLE IF NOT EXISTS activity_log_entries (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  rep_id      TEXT NOT NULL REFERENCES reps(id),
  metric_key  TEXT NOT NULL,
  label       TEXT NOT NULL,
  icon        TEXT NOT NULL,
  color       VARCHAR(12) NOT NULL,
  logged_at   TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_log_entries_rep       ON activity_log_entries (rep_id);
CREATE INDEX IF NOT EXISTS idx_log_entries_logged_at ON activity_log_entries (logged_at DESC);

-- Team-wide targets (one row per period)
-- period: 'daily' | 'weekly' | 'monthly'
CREATE TABLE IF NOT EXISTS targets (
  id      UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  period  TEXT NOT NULL CHECK (period IN ('daily', 'weekly', 'monthly')),
  dials   INTEGER NOT NULL DEFAULT 0,
  conv    INTEGER NOT NULL DEFAULT 0,
  vm      INTEGER NOT NULL DEFAULT 0,
  disc    INTEGER NOT NULL DEFAULT 0,
  demo    INTEGER NOT NULL DEFAULT 0,
  onb     INTEGER NOT NULL DEFAULT 0,
  closed  INTEGER NOT NULL DEFAULT 0,
  UNIQUE (period)
);

-- Enable realtime for live feed
ALTER PUBLICATION supabase_realtime ADD TABLE activity_log_entries;
