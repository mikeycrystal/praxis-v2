-- Make update_reading_streak idempotent per day.
--
-- The previous version excluded today's rows when finding the last read date,
-- so the "same day, no change" branch was unreachable: every call on a day
-- after a prior read day incremented the streak. A user reading N articles on
-- a consecutive day gained N streak days. The app now also gates the call to
-- once per UTC day (claimDailyStreakUpdate), but the server must not rely on
-- that.
--
-- Known limitation kept from the original: CURRENT_DATE is the database's
-- day (UTC), so a reader's day boundary is 8pm US Eastern. A follow-up could
-- accept the client's local date as a parameter.
CREATE OR REPLACE FUNCTION public.update_reading_streak(uid UUID)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  last_read_date DATE;
  today DATE := CURRENT_DATE;
  reads_today INTEGER;
BEGIN
  SELECT COUNT(*) INTO reads_today
  FROM public.read_articles
  WHERE user_id = uid AND read_at::DATE = today;

  -- The app calls this right after inserting today's read row, so more than
  -- one row today means today was already credited.
  IF reads_today > 1 THEN
    RETURN;
  END IF;

  SELECT MAX(read_at::DATE) INTO last_read_date
  FROM public.read_articles
  WHERE user_id = uid AND read_at::DATE < today;

  IF last_read_date = today - INTERVAL '1 day' THEN
    UPDATE public.profiles SET reading_streak = reading_streak + 1 WHERE id = uid;
  ELSE
    UPDATE public.profiles SET reading_streak = 1 WHERE id = uid;
  END IF;
END;
$$;
