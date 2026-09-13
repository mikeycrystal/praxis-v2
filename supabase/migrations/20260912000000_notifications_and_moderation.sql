-- Build 116: notification preferences + scheduled-push support + block/report.
-- Run against the existing flow-news Supabase project.

-- ============================================================
-- 1. Per-device timezone so scheduled pushes land at local time
-- ============================================================
ALTER TABLE public.push_tokens
  ADD COLUMN IF NOT EXISTS timezone TEXT,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ============================================================
-- 2. Notification preferences (server-enforced, defaults on)
-- ============================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS notify_digest BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_streak BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_social BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN IF NOT EXISTS notify_quiet_hours BOOLEAN NOT NULL DEFAULT TRUE;

-- ============================================================
-- 3. Push log: rotation, daily caps, lapse rules, social collapse
-- ============================================================
CREATE TABLE IF NOT EXISTS public.push_log (
  id         BIGSERIAL PRIMARY KEY,
  user_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  push_type  TEXT NOT NULL CHECK (push_type IN ('digest', 'streak', 'social', 'winback')),
  sent_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  meta       JSONB DEFAULT '{}'::jsonb
);
CREATE INDEX IF NOT EXISTS idx_push_log_user_type_time
  ON public.push_log (user_id, push_type, sent_at DESC);

ALTER TABLE public.push_log ENABLE ROW LEVEL SECURITY;
-- Service role only; no client policies on purpose.

-- ============================================================
-- 4. Blocking
-- ============================================================
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  blocked_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;

CREATE POLICY "blocked_users_select_own" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- True when either side has blocked the other.
CREATE OR REPLACE FUNCTION public.is_blocked_pair(a UUID, b UUID)
RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.blocked_users
    WHERE (blocker_id = a AND blocked_id = b)
       OR (blocker_id = b AND blocked_id = a)
  );
$$;

-- Blocking removes the social edge in both directions.
CREATE OR REPLACE FUNCTION public.on_block_cleanup()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  DELETE FROM public.follows
  WHERE (follower_id = NEW.blocker_id AND following_id = NEW.blocked_id)
     OR (follower_id = NEW.blocked_id AND following_id = NEW.blocker_id);
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_block_cleanup ON public.blocked_users;
CREATE TRIGGER trg_block_cleanup
  AFTER INSERT ON public.blocked_users
  FOR EACH ROW EXECUTE FUNCTION public.on_block_cleanup();

-- No new messages between blocked pairs (replaces the plain INSERT policy).
DROP POLICY IF EXISTS "Users send messages" ON public.messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.messages;
CREATE POLICY "Users send messages" ON public.messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id
    AND NOT public.is_blocked_pair(sender_id, recipient_id)
  );

-- No new follows of/by someone you're block-linked with.
CREATE OR REPLACE FUNCTION public.guard_follow_not_blocked()
RETURNS TRIGGER
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF public.is_blocked_pair(NEW.follower_id, NEW.following_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_follow_block_guard ON public.follows;
CREATE TRIGGER trg_follow_block_guard
  BEFORE INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.guard_follow_not_blocked();

-- ============================================================
-- 5. Reports
-- ============================================================
CREATE TABLE IF NOT EXISTS public.moderation_reports (
  id           BIGSERIAL PRIMARY KEY,
  reporter_id  UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  subject_type TEXT NOT NULL CHECK (subject_type IN ('user', 'conversation', 'message')),
  subject_id   TEXT NOT NULL,
  reason       TEXT NOT NULL,
  details      TEXT,
  status       TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned', 'dismissed')),
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_insert_own" ON public.moderation_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
CREATE POLICY "reports_select_own" ON public.moderation_reports
  FOR SELECT USING (auth.uid() = reporter_id);

-- ============================================================
-- 6. Scheduling (run once, in the dashboard SQL editor, AFTER the
--    two new edge functions are deployed — pg_cron + pg_net calls)
-- ============================================================
-- SELECT cron.schedule('praxis-digest-push', '0 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://cglrznkcrgwalnwzkhfj.supabase.co/functions/v1/send-daily-digest-push',
--     headers := '{"Content-Type": "application/json", "x-praxis-cron-secret": "<SET ME>"}'::jsonb,
--     body := '{}'::jsonb
--   );
-- $$);
-- SELECT cron.schedule('praxis-streak-push', '30 * * * *', $$
--   SELECT net.http_post(
--     url := 'https://cglrznkcrgwalnwzkhfj.supabase.co/functions/v1/send-streak-saver-push',
--     headers := '{"Content-Type": "application/json", "x-praxis-cron-secret": "<SET ME>"}'::jsonb,
--     body := '{}'::jsonb
--   );
-- $$);
