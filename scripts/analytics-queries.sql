-- ============================================================
-- STEPSCALE KPI ANALYTICS QUERIES
-- Run these in Metabase via copy-paste
-- ============================================================


-- ============================================================
-- 1. WEEKLY DISCOVERY & DEMO BOOKINGS + ATTENDANCE
--    Since July 1st, broken out by week
-- ============================================================
SELECT
  DATE_TRUNC('week', scheduled_date::date)::date AS week_starting,
  COUNT(*) FILTER (WHERE activity_type = 'disc')                                  AS disc_booked,
  COUNT(*) FILTER (WHERE activity_type = 'disc' AND status = 'attended')          AS disc_attended,
  COUNT(*) FILTER (WHERE activity_type = 'demo')                                  AS demo_booked,
  COUNT(*) FILTER (WHERE activity_type = 'demo' AND status = 'attended')          AS demo_attended
FROM calendar
WHERE scheduled_date >= '2026-07-01'
GROUP BY DATE_TRUNC('week', scheduled_date::date)
ORDER BY week_starting;


-- ============================================================
-- 2. WEEKLY AVERAGES (completed weeks only, since July 1st)
-- ============================================================
SELECT
  ROUND(AVG(disc_booked),   1) AS avg_disc_booked_per_week,
  ROUND(AVG(disc_attended), 1) AS avg_disc_attended_per_week,
  ROUND(AVG(demo_booked),   1) AS avg_demo_booked_per_week,
  ROUND(AVG(demo_attended), 1) AS avg_demo_attended_per_week
FROM (
  SELECT
    DATE_TRUNC('week', scheduled_date::date)::date AS week_starting,
    COUNT(*) FILTER (WHERE activity_type = 'disc')                         AS disc_booked,
    COUNT(*) FILTER (WHERE activity_type = 'disc' AND status = 'attended') AS disc_attended,
    COUNT(*) FILTER (WHERE activity_type = 'demo')                         AS demo_booked,
    COUNT(*) FILTER (WHERE activity_type = 'demo' AND status = 'attended') AS demo_attended
  FROM calendar
  WHERE scheduled_date >= '2026-07-01'
    AND DATE_TRUNC('week', scheduled_date::date) < DATE_TRUNC('week', CURRENT_DATE)
  GROUP BY DATE_TRUNC('week', scheduled_date::date)
) weekly;


-- ============================================================
-- 3. DISC & DEMO SHOW RATE — 2-WEEK OVER 2-WEEK
--    Period 1: 4 weeks ago → 2 weeks ago
--    Period 2: 2 weeks ago → today
--    Show rate = attended / (attended + no_show)
-- ============================================================
WITH periods AS (
  SELECT
    activity_type,
    COUNT(*) FILTER (
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '4 weeks'
        AND scheduled_date <  CURRENT_DATE - INTERVAL '2 weeks'
        AND status IN ('attended', 'no_show')
    ) AS p1_total,
    COUNT(*) FILTER (
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '4 weeks'
        AND scheduled_date <  CURRENT_DATE - INTERVAL '2 weeks'
        AND status = 'attended'
    ) AS p1_attended,
    COUNT(*) FILTER (
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '2 weeks'
        AND scheduled_date <= CURRENT_DATE
        AND status IN ('attended', 'no_show')
    ) AS p2_total,
    COUNT(*) FILTER (
      WHERE scheduled_date >= CURRENT_DATE - INTERVAL '2 weeks'
        AND scheduled_date <= CURRENT_DATE
        AND status = 'attended'
    ) AS p2_attended
  FROM calendar
  WHERE activity_type IN ('disc', 'demo')
  GROUP BY activity_type
)
SELECT
  activity_type,
  p1_attended || ' / ' || p1_total                                    AS p1_attended_of_total,
  ROUND(100.0 * p1_attended / NULLIF(p1_total, 0), 1)                 AS p1_show_rate_pct,
  p2_attended || ' / ' || p2_total                                    AS p2_attended_of_total,
  ROUND(100.0 * p2_attended / NULLIF(p2_total, 0), 1)                 AS p2_show_rate_pct,
  ROUND(
    (100.0 * p2_attended / NULLIF(p2_total, 0)) -
    (100.0 * p1_attended / NULLIF(p1_total, 0))
  , 1)                                                                 AS change_pct_points
FROM periods
ORDER BY activity_type;


-- ============================================================
-- 4. CLOSE RATE — MONTH OVER MONTH
--    Logic: demo attended → closed_deal matched by company name
--    June  : straightforward (full month, all outcomes known)
--    July  : excludes demos < 2 weeks old with no close yet
--            (outcome still pending within the 2-week close window)
-- ============================================================
WITH demo_outcomes AS (
  SELECT
    c.id,
    c.company_name,
    c.scheduled_date,
    DATE_TRUNC('month', c.scheduled_date::date)::date AS month,
    EXISTS (
      SELECT 1 FROM closed_deals cd
      WHERE cd.company_name = c.company_name
        AND cd.closed_date >= c.scheduled_date
    ) AS is_closed,
    c.scheduled_date <= CURRENT_DATE - INTERVAL '14 days' AS is_old
  FROM calendar c
  WHERE c.activity_type = 'demo'
    AND c.status = 'attended'
    AND c.scheduled_date >= '2026-06-01'
    AND c.scheduled_date <= CURRENT_DATE
),

june AS (
  SELECT
    'June' AS period,
    COUNT(*)                                    AS demos_in_denominator,
    COUNT(*) FILTER (WHERE is_closed)           AS closes,
    NULL::int                                   AS pending_excluded,
    ROUND(100.0 * COUNT(*) FILTER (WHERE is_closed) / NULLIF(COUNT(*), 0), 1) AS close_rate_pct
  FROM demo_outcomes
  WHERE month = '2026-06-01'
),

july AS (
  SELECT
    'July' AS period,
    COUNT(*) FILTER (WHERE is_closed OR is_old) AS demos_in_denominator,
    COUNT(*) FILTER (WHERE is_closed)           AS closes,
    COUNT(*) FILTER (WHERE NOT is_closed AND NOT is_old) AS pending_excluded,
    ROUND(
      100.0 * COUNT(*) FILTER (WHERE is_closed)
      / NULLIF(COUNT(*) FILTER (WHERE is_closed OR is_old), 0)
    , 1) AS close_rate_pct
  FROM demo_outcomes
  WHERE month = '2026-07-01'
)

SELECT * FROM june
UNION ALL
SELECT * FROM july;


-- ============================================================
-- 5. PIPELINE INTEGRITY — DEMOS WITH NO PRIOR DISCOVERY CALL
--    Flags demos where company_name has no disc call on record
-- ============================================================
SELECT
  d.company_name,
  d.scheduled_date  AS demo_date,
  d.status          AS demo_status,
  d.rep_id
FROM calendar d
WHERE d.activity_type = 'demo'
  AND d.scheduled_date >= '2026-07-01'
  AND NOT EXISTS (
    SELECT 1 FROM calendar disc
    WHERE disc.company_name = d.company_name
      AND disc.activity_type = 'disc'
  )
ORDER BY d.scheduled_date;


-- ============================================================
-- 6. CLIENT BASE DOUBLING TIME
--    Cumulative signups by since_date: when we hit 1, 2, 4, 8, ...
--    and days between each doubling.
-- ============================================================
WITH ordered AS (
  SELECT
    name,
    since_date,
    ROW_NUMBER() OVER (ORDER BY since_date ASC, created_at ASC) AS n
  FROM clients
),
targets AS (
  SELECT 1 AS target UNION ALL SELECT 2 UNION ALL SELECT 4 UNION ALL SELECT 8
  UNION ALL SELECT 16 UNION ALL SELECT 32 UNION ALL SELECT 64 UNION ALL SELECT 128
),
hits AS (
  SELECT
    t.target,
    o.since_date AS hit_date,
    o.name AS crossing_client
  FROM targets t
  JOIN ordered o ON o.n = t.target
),
with_lag AS (
  SELECT
    target,
    hit_date,
    crossing_client,
    LAG(hit_date) OVER (ORDER BY target) AS prev_hit_date,
    (SELECT MIN(since_date) FROM clients) AS first_date
  FROM hits
)
SELECT
  target AS clients,
  hit_date,
  crossing_client,
  CASE WHEN prev_hit_date IS NULL THEN NULL
       ELSE hit_date - prev_hit_date END AS days_from_prev_doubling,
  hit_date - first_date AS days_from_first_client
FROM with_lag
ORDER BY target;

-- Current count + elapsed from first client
SELECT
  COUNT(*) AS total_signed,
  COUNT(*) FILTER (
    WHERE since_date <= CURRENT_DATE
      AND (cancel_date IS NULL OR cancel_date > CURRENT_DATE)
  ) AS active_today,
  MIN(since_date) AS first_client_date,
  CURRENT_DATE - MIN(since_date) AS days_since_first
FROM clients;

