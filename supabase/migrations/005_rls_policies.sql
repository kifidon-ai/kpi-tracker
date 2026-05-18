-- ============================================================
-- RLS policies: authenticated users can read/write all tables.
-- This is an internal tool — all users are @stepscale.ai staff.
-- ============================================================

-- reps
ALTER TABLE public.reps ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read reps"
  ON public.reps FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert reps"
  ON public.reps FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update reps"
  ON public.reps FOR UPDATE TO authenticated USING (true);

-- clients
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read clients"
  ON public.clients FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert clients"
  ON public.clients FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update clients"
  ON public.clients FOR UPDATE TO authenticated USING (true);

-- activity_daily
ALTER TABLE public.activity_daily ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read activity_daily"
  ON public.activity_daily FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert activity_daily"
  ON public.activity_daily FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update activity_daily"
  ON public.activity_daily FOR UPDATE TO authenticated USING (true);

-- activity_log_entries
ALTER TABLE public.activity_log_entries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read activity_log_entries"
  ON public.activity_log_entries FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert activity_log_entries"
  ON public.activity_log_entries FOR INSERT TO authenticated WITH CHECK (true);

-- targets
ALTER TABLE public.targets ENABLE ROW LEVEL SECURITY;
CREATE POLICY "authenticated users can read targets"
  ON public.targets FOR SELECT TO authenticated USING (true);
CREATE POLICY "authenticated users can insert targets"
  ON public.targets FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "authenticated users can update targets"
  ON public.targets FOR UPDATE TO authenticated USING (true);
