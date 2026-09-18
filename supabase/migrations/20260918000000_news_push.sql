ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_news BOOLEAN NOT NULL DEFAULT TRUE;
-- push_log.push_type has a CHECK; extend it.
ALTER TABLE public.push_log DROP CONSTRAINT IF EXISTS push_log_push_type_check;
ALTER TABLE public.push_log ADD CONSTRAINT push_log_push_type_check
  CHECK (push_type IN ('digest','streak','social','winback','news','breaking','split'));
CREATE INDEX IF NOT EXISTS idx_push_log_cluster ON public.push_log ((meta->>'cluster_id'));

-- ============================================================
-- Scheduling (run once, in the dashboard SQL editor, AFTER the
-- edge function is deployed — pg_cron + pg_net calls)
-- ============================================================
-- SELECT cron.schedule('praxis-news-push', '7,27,47 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://cglrznkcrgwalnwzkhfj.supabase.co/functions/v1/send-news-push',
--     headers := '{"Content-Type": "application/json", "x-praxis-cron-secret": "<SET ME>"}'::jsonb,
--     body := '{}'::jsonb
--   );
-- $$);
