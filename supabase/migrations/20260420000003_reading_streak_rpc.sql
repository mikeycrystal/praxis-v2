-- Update reading streak: increments if last read was yesterday, resets if gap > 1 day, no-op if same day
CREATE OR REPLACE FUNCTION public.update_reading_streak(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  last_read_date DATE;
  today DATE := CURRENT_DATE;
BEGIN
  SELECT MAX(read_at::DATE) INTO last_read_date
  FROM public.read_articles
  WHERE user_id = uid AND read_at::DATE < today;

  IF last_read_date IS NULL THEN
    -- First ever read on a new day — start streak at 1
    UPDATE public.profiles SET reading_streak = 1 WHERE id = uid AND reading_streak = 0;
  ELSIF last_read_date = today - INTERVAL '1 day' THEN
    -- Consecutive day — increment
    UPDATE public.profiles SET reading_streak = reading_streak + 1 WHERE id = uid;
  ELSIF last_read_date < today - INTERVAL '1 day' THEN
    -- Missed a day — reset to 1
    UPDATE public.profiles SET reading_streak = 1 WHERE id = uid;
  END IF;
  -- If last_read_date = today: same day, no change to streak
END;
$$;

-- Increment followers_count when a follow is created
CREATE OR REPLACE FUNCTION public.on_follow_insert()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
  UPDATE public.profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_follow_insert
  AFTER INSERT ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.on_follow_insert();

-- Decrement followers_count when a follow is deleted
CREATE OR REPLACE FUNCTION public.on_follow_delete()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.profiles SET followers_count = GREATEST(followers_count - 1, 0) WHERE id = OLD.following_id;
  UPDATE public.profiles SET following_count = GREATEST(following_count - 1, 0) WHERE id = OLD.follower_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER trg_follow_delete
  AFTER DELETE ON public.follows
  FOR EACH ROW EXECUTE FUNCTION public.on_follow_delete();
