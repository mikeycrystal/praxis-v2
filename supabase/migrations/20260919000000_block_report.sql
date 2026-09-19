-- Block and report controls for user-generated social content.
-- The preceding migration introduced an earlier report shape; replace it with
-- the review workflow below before this client is released.

CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id UUID NOT NULL REFERENCES auth.users,
  blocked_id UUID NOT NULL REFERENCES auth.users,
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);

-- Normalize the prior migration's cascading foreign keys to the specified
-- references before applying the client-facing policies.
DO $$
DECLARE constraint_name TEXT;
BEGIN
  FOR constraint_name IN
    SELECT conname FROM pg_constraint
    WHERE conrelid = 'public.blocked_users'::regclass AND contype = 'f'
  LOOP
    EXECUTE format('ALTER TABLE public.blocked_users DROP CONSTRAINT %I', constraint_name);
  END LOOP;
END $$;
-- ON DELETE CASCADE is load-bearing: the delete-account function removes the
-- auth.users row, and without the cascade any block row (either direction)
-- makes account deletion fail with an FK violation (App Store 5.1.1(v)).
ALTER TABLE public.blocked_users
  ADD CONSTRAINT blocked_users_blocker_id_fkey FOREIGN KEY (blocker_id) REFERENCES auth.users ON DELETE CASCADE,
  ADD CONSTRAINT blocked_users_blocked_id_fkey FOREIGN KEY (blocked_id) REFERENCES auth.users ON DELETE CASCADE;

ALTER TABLE public.blocked_users ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "blocked_users_select_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_insert_own" ON public.blocked_users;
DROP POLICY IF EXISTS "blocked_users_delete_own" ON public.blocked_users;
CREATE POLICY "blocked_users_select_own" ON public.blocked_users
  FOR SELECT USING (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_insert_own" ON public.blocked_users
  FOR INSERT WITH CHECK (auth.uid() = blocker_id);
CREATE POLICY "blocked_users_delete_own" ON public.blocked_users
  FOR DELETE USING (auth.uid() = blocker_id);

-- Preserve the older, incompatible internal queue for operations to export;
-- conversation reports cannot be losslessly mapped to this target-user shape.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname = 'public' AND tablename = 'moderation_reports') THEN
    ALTER TABLE public.moderation_reports RENAME TO moderation_reports_legacy_20260919;
  END IF;
END $$;

CREATE TABLE public.moderation_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id UUID NOT NULL,
  target_user_id UUID NOT NULL,
  target_type TEXT NOT NULL CHECK (target_type IN ('message', 'profile')),
  target_id TEXT,
  reason TEXT NOT NULL CHECK (reason IN ('spam', 'harassment', 'hate', 'violence', 'impersonation', 'other')),
  details TEXT,
  status TEXT NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'reviewed', 'actioned')),
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.moderation_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "moderation_reports_insert_own" ON public.moderation_reports
  FOR INSERT WITH CHECK (auth.uid() = reporter_id);
-- Deliberately no SELECT policy: only the service role can read reports.

CREATE INDEX moderation_reports_status_created_at_idx
  ON public.moderation_reports (status, created_at);
