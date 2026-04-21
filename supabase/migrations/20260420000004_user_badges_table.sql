-- User badges table — stores awarded badges with denormalized display data
-- (no FK to a badges lookup table — badge definitions live in the award-badge Edge Function)
CREATE TABLE IF NOT EXISTS public.user_badges (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_id    TEXT NOT NULL,
  name        TEXT NOT NULL,
  icon        TEXT NOT NULL,
  description TEXT NOT NULL,
  earned_at   TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, badge_id)
);
ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see own badges"
  ON public.user_badges FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Badges are public"
  ON public.user_badges FOR SELECT USING (true);
