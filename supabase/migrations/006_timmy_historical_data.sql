-- Historical activity data for Timmy Ifidon
-- Aggregated from hourly logs (Apr 8 – May 8, 2026)
-- Columns: rep_id, date, dials, conv, vm, disc, demo, onb, closed

INSERT INTO activity_daily (rep_id, date, dials, conv, vm, disc, demo, onb, closed)
VALUES
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-08', 25, 10, 0,  2, 3, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-13',  6,  3, 0,  3, 2, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-23', 14,  4, 0,  2, 0, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-24', 23,  4, 0,  3, 0, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-27', 30,  9, 9,  4, 3, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-28', 28,  5,12,  3, 2, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-29', 21,  5, 3,  2, 1, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-04-30', 34, 11, 8,  7, 3, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-01',  4,  1, 0,  1, 0, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-04',  8,  6, 1,  4, 3, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-05', 12,  3, 2,  1, 1, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-06', 22, 10, 3,  5, 0, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-07', 22,  3, 6,  2, 2, 0, 0),
  ('7673cb29-609c-4e02-827f-20d81140686c', '2026-05-08',  1,  1, 0,  1, 0, 0, 0)
ON CONFLICT (rep_id, date) DO UPDATE SET
  dials  = EXCLUDED.dials,
  conv   = EXCLUDED.conv,
  vm     = EXCLUDED.vm,
  disc   = EXCLUDED.disc,
  demo   = EXCLUDED.demo,
  onb    = EXCLUDED.onb,
  closed = EXCLUDED.closed;
