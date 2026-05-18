-- ============================================================
-- Fix: idempotent script that ensures user_id column exists,
-- trigger is in place, and all existing auth users have a rep row.
-- Safe to run multiple times.
-- ============================================================

-- 1. Add user_id column if it wasn't added yet
ALTER TABLE public.reps ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id);

-- 2. Recreate the trigger function 
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  email_prefix  TEXT;
  name_parts    TEXT[];
  full_name     TEXT;
  initials_text TEXT;
  colors        TEXT[] := ARRAY[
    '#00D4FF','#FF3D9A','#FFB800','#00E5A0',
    '#8B5CF6','#3B82F6','#FF5468','#F2A300'
  ];
  rep_count     INT;
  chosen_color  TEXT;
BEGIN
  email_prefix  := split_part(NEW.email, '@', 1);
  name_parts    := regexp_split_to_array(email_prefix, '[._]');
  full_name     := array_to_string(
                     ARRAY(SELECT initcap(p) FROM unnest(name_parts) AS p), ' ');
  initials_text := array_to_string(
                     ARRAY(SELECT upper(left(p, 1)) FROM unnest(name_parts) AS p LIMIT 3), '');
  SELECT COUNT(*) INTO rep_count FROM public.reps;
  chosen_color := colors[(rep_count % array_length(colors, 1)) + 1];

  INSERT INTO public.reps (id, name, initials, color, joined_date, role, user_id)
  VALUES (NEW.id::TEXT, full_name, initials_text, chosen_color, CURRENT_DATE, 'SDR', NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Recreate the trigger
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- 4. Backfill all existing auth users who don't have a rep yet
DO $$
DECLARE
  u             RECORD;
  email_prefix  TEXT;
  name_parts    TEXT[];
  full_name     TEXT;
  initials_text TEXT;
  colors        TEXT[] := ARRAY[
    '#00D4FF','#FF3D9A','#FFB800','#00E5A0',
    '#8B5CF6','#3B82F6','#FF5468','#F2A300'
  ];
  rep_count     INT;
  chosen_color  TEXT;
BEGIN
  FOR u IN
    SELECT au.id, au.email
    FROM auth.users au
    LEFT JOIN public.reps r ON r.user_id = au.id
    WHERE r.id IS NULL
      AND au.email IS NOT NULL
  LOOP
    email_prefix  := split_part(u.email, '@', 1);
    name_parts    := regexp_split_to_array(email_prefix, '[._]');
    full_name     := array_to_string(
                       ARRAY(SELECT initcap(p) FROM unnest(name_parts) AS p), ' ');
    initials_text := array_to_string(
                       ARRAY(SELECT upper(left(p, 1)) FROM unnest(name_parts) AS p LIMIT 3), '');
    SELECT COUNT(*) INTO rep_count FROM public.reps;
    chosen_color := colors[(rep_count % array_length(colors, 1)) + 1];

    INSERT INTO public.reps (id, name, initials, color, joined_date, role, user_id)
    VALUES (u.id::TEXT, full_name, initials_text, chosen_color, CURRENT_DATE, 'SDR', u.id)
    ON CONFLICT (user_id) DO NOTHING;
  END LOOP;
END $$;
