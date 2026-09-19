-- The profile month-map card reads the signed-in user's own read events
-- (article_read_complete rows now carry article_x/article_y). Users can
-- see only their own analytics rows; anonymous/guest rows stay unreadable.
DROP POLICY IF EXISTS "Users read own analytics events" ON public.analytics_events;
CREATE POLICY "Users read own analytics events" ON public.analytics_events
  FOR SELECT USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event_time
  ON public.analytics_events (user_id, event_name, created_at DESC);
