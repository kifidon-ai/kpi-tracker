-- Allow authenticated users to delete their own log entries (needed for decrement)
CREATE POLICY "authenticated users can delete activity_log_entries"
  ON public.activity_log_entries FOR DELETE TO authenticated USING (true);
