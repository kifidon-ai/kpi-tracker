-- Create metrics lookup table
CREATE TABLE IF NOT EXISTS metrics (
  key TEXT PRIMARY KEY,
  label TEXT NOT NULL,
  icon TEXT NOT NULL,
  color VARCHAR(12) NOT NULL
);

-- Add rep_id to targets and remove unique constraint on period
ALTER TABLE targets
ADD COLUMN rep_id TEXT NOT NULL REFERENCES reps(id);

DROP INDEX IF EXISTS "targets_period_unique";
CREATE INDEX idx_targets_rep_period ON targets(rep_id, period);

-- Update calendar table
ALTER TABLE calendar
ADD COLUMN client_id UUID NOT NULL REFERENCES clients(id),
DROP COLUMN IF EXISTS company_name,
DROP COLUMN IF EXISTS monthly_price;

CREATE INDEX idx_calendar_client ON calendar(client_id);

-- Recreate closed_deals table
DROP TABLE IF EXISTS closed_deals;
CREATE TABLE closed_deals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_id UUID NOT NULL REFERENCES clients(id),
  activity_log_id UUID NOT NULL REFERENCES activity_log_entries(id),
  closed_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_closed_deals_client ON closed_deals(client_id);
CREATE INDEX idx_closed_deals_activity_log ON closed_deals(activity_log_id);

-- Update activity_log_entries to use metrics FK
ALTER TABLE activity_log_entries
ADD COLUMN metric_key_new TEXT REFERENCES metrics(key);

-- Copy data from old metric_key (if it exists) to new one
UPDATE activity_log_entries SET metric_key_new = metric_key WHERE metric_key_new IS NULL;

-- Drop old columns and rename new one
ALTER TABLE activity_log_entries
DROP COLUMN label,
DROP COLUMN icon,
DROP COLUMN color,
DROP COLUMN metric_key;

ALTER TABLE activity_log_entries
RENAME COLUMN metric_key_new TO metric_key;

ALTER TABLE activity_log_entries
ALTER COLUMN metric_key SET NOT NULL;

-- Drop daily_checklist table
DROP TABLE IF EXISTS daily_checklist;
