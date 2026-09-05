import { supabase } from '../services/supabase';

// Port of the web app's digest-streak award (card-page Index.tsx): the
// streak is profiles.current_streak, advanced once per America/New_York day
// when the Daily Digest is completed, then badges are re-checked. Mobile
// previously never touched this column, so mobile-only readers stayed flat.
const getNewYorkDate = (date = new Date()) => {
  const local = new Date(date.toLocaleString('en-US', { timeZone: 'America/New_York' }));
  const year = local.getFullYear();
  const month = String(local.getMonth() + 1).padStart(2, '0');
  const day = String(local.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

export const awardDigestStreak = async (userId: string): Promise<number | null> => {
  try {
    const todayEST = getNewYorkDate();
    const yesterday = new Date(todayEST);
    yesterday.setDate(yesterday.getDate() - 1);
    const yesterdayEST = yesterday.toISOString().split('T')[0];

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
