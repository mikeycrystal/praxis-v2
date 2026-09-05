import { supabase } from '../services/supabase';

// Port of the web app's digest-streak award (card-page Index.tsx): the
// streak is profiles.current_streak, advanced once per America/New_York day
// when the Daily Digest is completed, then badges are re-checked. Mobile
// previously never touched this column, so mobile-only readers stayed flat.
const NY_DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

// YYYY-MM-DD in America/New_York. Intl formatting is the path the Daily
// Digest already relies on for its day key on device; the toLocaleString +
// Date.parse route is kept only as a fallback because Hermes does not
// guarantee parsing of locale strings.
export const getNewYorkDate = (date = new Date()) => {
  try {
    const formatted = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/New_York',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(date);
    if (NY_DATE_PATTERN.test(formatted)) return formatted;
  } catch {
    // fall through
  }
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const safe = Number.isNaN(local.getTime()) ? date : local;
  const year = safe.getFullYear();
  const month = String(safe.getMonth() + 1).padStart(2, '0');
  const day = String(safe.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

// The calendar day before a YYYY-MM-DD string, computed in UTC so the
// device timezone cannot shift it. Returns null for anything unparseable
// instead of throwing.
export const getPreviousDate = (isoDate: string): string | null => {
  if (!NY_DATE_PATTERN.test(isoDate)) return null;
  const [year, month, day] = isoDate.split('-').map(Number);
  const previous = new Date(Date.UTC(year, month - 1, day - 1));
  if (Number.isNaN(previous.getTime())) return null;
  return previous.toISOString().split('T')[0];
};

// Web rule (card-page useLeaderboard.tsx): a streak counts as live only if
// the digest was completed today or yesterday, New York time. Anything older
// is shown as 0 until the nightly reset catches up with it. If the dates
// cannot be computed, the streak is left as stored rather than hidden.
export const isStreakLive = (lastCompletedDate: string | null | undefined) => {
  if (!lastCompletedDate) return false;
  try {
    const yesterday = getPreviousDate(getNewYorkDate());
    if (!yesterday) return true;
    return lastCompletedDate.slice(0, 10) >= yesterday;
  } catch {
    return true;
  }
};

export const awardDigestStreak = async (userId: string): Promise<number | null> => {
  try {
    const todayEST = getNewYorkDate();
    const yesterdayEST = getPreviousDate(todayEST);
    if (!yesterdayEST) throw new Error(`Could not compute New York dates from ${todayEST}`);

    const { data: profile, error: readError } = await supabase
      .from('profiles')
      .select('current_streak, longest_streak, streak_last_completed_date')
      .eq('id', userId)
      .single();
    if (readError || !profile) return null;

    if (profile.streak_last_completed_date === todayEST) {
      return profile.current_streak ?? 0;
    }

    const nextStreak = profile.streak_last_completed_date === yesterdayEST
      ? (profile.current_streak ?? 0) + 1
      : 1;
    const nextLongest = Math.max(profile.longest_streak ?? 0, nextStreak);

    const { error: writeError } = await supabase
      .from('profiles')
      .update({
        current_streak: nextStreak,
        longest_streak: nextLongest,
        streak_last_completed_date: todayEST,
      })
      .eq('id', userId);
    if (writeError) throw writeError;

    await supabase.rpc('check_and_award_badges', { p_user_id: userId });
    return nextStreak;
  } catch (error) {
    console.warn('[digestStreak] Failed to award digest streak', error);
    return null;
  }
};
