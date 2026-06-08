-- Migrate all gk_conv and conv entries to dm_conv
UPDATE activity_log_entries
SET metric_key = 'dm_conv'
WHERE metric_key IN ('gk_conv', 'conv');

-- Update targets: sum gk_conv and any remaining conv into dm_conv
UPDATE targets
SET dm_conv = dm_conv + gk_conv
WHERE gk_conv > 0;

-- Drop gk_conv column from targets since we're consolidating to dm_conv only
ALTER TABLE targets
DROP COLUMN IF EXISTS gk_conv;
