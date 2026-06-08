-- Add gk_conv and dm_conv columns to targets table
ALTER TABLE targets
ADD COLUMN IF NOT EXISTS gk_conv integer NOT NULL DEFAULT 0,
ADD COLUMN IF NOT EXISTS dm_conv integer NOT NULL DEFAULT 0;

-- Migrate data from conv to split (50/50 split)
UPDATE targets
SET gk_conv = CEIL(conv::numeric / 2)::integer,
    dm_conv = FLOOR(conv::numeric / 2)::integer
WHERE conv > 0 AND (gk_conv = 0 AND dm_conv = 0);

-- Drop the old conv column
ALTER TABLE targets
DROP COLUMN IF EXISTS conv;
