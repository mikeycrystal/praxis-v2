-- Atomic increment of articles_read counter (called after a new read is recorded)
CREATE OR REPLACE FUNCTION public.increment_articles_read(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles
  SET articles_read = articles_read + 1
  WHERE id = uid;
END;
$$;
