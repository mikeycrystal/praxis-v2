-- praxis-v2 additional tables
-- Run against the existing flow-news Supabase project

-- ─── Push tokens ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_tokens (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token       TEXT NOT NULL,
  platform    TEXT CHECK (platform IN ('ios', 'android')),
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, token)
);
ALTER TABLE public.push_tokens ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own push tokens"
  ON public.push_tokens FOR ALL USING (auth.uid() = user_id);

-- ─── Likes ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.likes (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id  BIGINT NOT NULL REFERENCES public.article(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ DEFAULT now(),
  UNIQUE (user_id, article_id)
);
ALTER TABLE public.likes ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own likes"
  ON public.likes FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Likes are public"
  ON public.likes FOR SELECT USING (true);

-- ─── Comments ────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.comments (
  id          BIGSERIAL PRIMARY KEY,
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  article_id  BIGINT NOT NULL REFERENCES public.article(id) ON DELETE CASCADE,
  body        TEXT NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users manage own comments"
  ON public.comments FOR ALL USING (auth.uid() = user_id);
CREATE POLICY "Comments are public"
  ON public.comments FOR SELECT USING (true);

-- ─── Messages (chat) ─────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.messages (
  id              BIGSERIAL PRIMARY KEY,
  conversation_id TEXT NOT NULL,      -- format: sorted(user_id_a, user_id_b)
  sender_id       UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recipient_id    UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  body            TEXT NOT NULL,
  read_at         TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Users see their own messages"
  ON public.messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = recipient_id);
CREATE POLICY "Users send messages"
  ON public.messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

CREATE INDEX IF NOT EXISTS messages_conversation_idx ON public.messages(conversation_id, created_at);
CREATE INDEX IF NOT EXISTS messages_recipient_idx ON public.messages(recipient_id, read_at);

-- ─── Helper function: delete current user ────────────────────────────────────
CREATE OR REPLACE FUNCTION public.delete_current_user()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  DELETE FROM auth.users WHERE id = auth.uid();
END;
$$;
