-- Historical activity data for Mujeeb
-- Aggregated from hourly logs (May 4 – May 14, 2026)
-- Columns: dials, conv, vm, disc, demo

DO $$
DECLARE
  mujeeb_id TEXT;
BEGIN
  SELECT id INTO mujeeb_id FROM public.reps WHERE name ILIKE '%mujeeb%' LIMIT 1;
  IF mujeeb_id IS NULL THEN
    RAISE EXCEPTION 'Rep matching "mujeeb" not found in reps table';
  END IF;

  INSERT INTO activity_daily (rep_id, date, dials, conv, vm, disc, demo, onb, closed)
  VALUES
    (mujeeb_id, '2026-05-04', 19,  9, 1, 4, 0, 0, 0),
    (mujeeb_id, '2026-05-05', 21,  6, 0, 3, 2, 0, 0),
    (mujeeb_id, '2026-05-06', 21,  8, 5, 4, 2, 0, 0),
    (mujeeb_id, '2026-05-07', 23,  6, 0, 1, 2, 0, 0),
    (mujeeb_id, '2026-05-08', 17,  2, 6, 1, 0, 0, 0),
    (mujeeb_id, '2026-05-11', 60,  8, 7, 3, 1, 0, 0),
    (mujeeb_id, '2026-05-12', 36,  9, 7, 4, 0, 0, 0),
    (mujeeb_id, '2026-05-13', 31, 11, 1, 7, 4, 0, 0),
    (mujeeb_id, '2026-05-14', 24,  6, 0, 2, 2, 0, 0)
  ON CONFLICT (rep_id, date) DO UPDATE SET
    dials  = EXCLUDED.dials,
    conv   = EXCLUDED.conv,
    vm     = EXCLUDED.vm,
    disc   = EXCLUDED.disc,
    demo   = EXCLUDED.demo,
    onb    = EXCLUDED.onb,
    closed = EXCLUDED.closed;
END $$;
