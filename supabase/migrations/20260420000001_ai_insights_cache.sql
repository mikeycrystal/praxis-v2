-- AI Insights cache — stores OpenAI analysis results per article
CREATE TABLE IF NOT EXISTS public.ai_insights (
  article_id  BIGINT PRIMARY KEY REFERENCES public.article(id) ON DELETE CASCADE,
  insights    JSONB NOT NULL,
  created_at  TIMESTAMPTZ DEFAULT now()
);
-- No RLS needed — read-only public data, written only by Edge Functions (service role)
