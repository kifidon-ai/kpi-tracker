-- ============================================================
-- Auto-create a rep row when a new Supabase auth user is added.
-- Run this in Supabase SQL Editor after 001_schema.sql.
-- ============================================================

-- 1. Link reps to auth users
ALTER TABLE reps ADD COLUMN IF NOT EXISTS user_id UUID UNIQUE REFERENCES auth.users(id);

-- 2. Function: derive rep data from the new user's email and insert
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
  -- Extract the part before '@'
  email_prefix := split_part(NEW.email, '@', 1);

  -- Split on dots/underscores and capitalise each word
  name_parts := regexp_split_to_array(email_prefix, '[._]');
  full_name  := array_to_string(
    ARRAY(SELECT initcap(p) FROM unnest(name_parts) AS p),
    ' '
  );

  -- Initials: first letter of each word, up to 3
  initials_text := array_to_string(
    ARRAY(SELECT upper(left(p, 1)) FROM unnest(name_parts) AS p LIMIT 3),
    ''
  );

  -- Cycle through colour palette based on current rep count
  SELECT COUNT(*) INTO rep_count FROM public.reps;
  chosen_color := colors[(rep_count % array_length(colors, 1)) + 1];

  INSERT INTO public.reps (id, name, initials, color, joined_date, role, user_id)
  VALUES (
    NEW.id::TEXT,   -- use the auth UUID as the rep id
    full_name,
    initials_text,
    chosen_color,
    CURRENT_DATE,
    'SDR',
    NEW.id
  )
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- 3. Fire the function on every new auth user
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();
