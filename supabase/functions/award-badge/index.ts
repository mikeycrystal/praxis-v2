import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Badge definitions: { id, name, description, icon, condition(profile) => boolean }
const BADGES = [
  { id: 'first_read',    name: 'First Read',    icon: '📖', description: 'Read your first article',            check: (p: any) => p.articles_read >= 1 },
  { id: 'bookworm',      name: 'Bookworm',       icon: '🐛', description: 'Read 10 articles',                  check: (p: any) => p.articles_read >= 10 },
  { id: 'avid_reader',   name: 'Avid Reader',    icon: '📚', description: 'Read 50 articles',                  check: (p: any) => p.articles_read >= 50 },
  { id: 'century',       name: 'Century',        icon: '💯', description: 'Read 100 articles',                 check: (p: any) => p.articles_read >= 100 },
  { id: 'streak_3',      name: 'Hat Trick',      icon: '🔥', description: '3-day reading streak',              check: (p: any) => p.reading_streak >= 3 },
  { id: 'streak_7',      name: 'Week Warrior',   icon: '⚡', description: '7-day reading streak',              check: (p: any) => p.reading_streak >= 7 },
  { id: 'streak_30',     name: 'Monthly Maven',  icon: '🏆', description: '30-day reading streak',             check: (p: any) => p.reading_streak >= 30 },
  { id: 'social_1',      name: 'Connected',      icon: '🤝', description: 'Get your first follower',           check: (p: any) => p.followers_count >= 1 },
  { id: 'social_10',     name: 'Influencer',     icon: '⭐', description: 'Reach 10 followers',               check: (p: any) => p.followers_count >= 10 },
];

// Called by app after profile updates (articles_read, reading_streak, followers_count change)
// Body: { userId }
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { userId } = await req.json();
    if (!userId) throw new Error('userId required');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Fetch profile
    const { data: profile } = await supabase
      .from('profiles')
      .select('articles_read, reading_streak, followers_count')
      .eq('id', userId)
      .single();

    if (!profile) throw new Error('Profile not found');

    // Fetch already-awarded badges
    const { data: existing } = await supabase
      .from('user_badges')
      .select('badge_id')
      .eq('user_id', userId);

    const existingIds = new Set((existing ?? []).map((b: any) => b.badge_id));

    // Determine newly earned badges
    const newBadges = BADGES.filter(b => !existingIds.has(b.id) && b.check(profile));

    if (newBadges.length === 0) {
      return new Response(JSON.stringify({ awarded: [] }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Insert new badges
    const rows = newBadges.map(b => ({
      user_id: userId,
      badge_id: b.id,
      name: b.name,
      icon: b.icon,
      description: b.description,
      earned_at: new Date().toISOString(),
    }));

    await supabase.from('user_badges').insert(rows);

    // Optionally send push notifications for newly earned badges
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', userId);

    if (tokens && tokens.length > 0) {
      const messages = newBadges.flatMap(badge =>
        tokens.map(({ token }: { token: string }) => ({
          to: token,
          title: `Badge Earned: ${badge.name} ${badge.icon}`,
          body: badge.description,
          data: { type: 'badge', badgeId: badge.id },
          sound: 'default',
        }))
      );
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messages),
      }).catch(() => {});
    }

    return new Response(JSON.stringify({ awarded: newBadges.map(b => b.id) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
