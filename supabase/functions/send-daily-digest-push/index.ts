import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

// Runs hourly via pg_cron (minute 0). Sends the morning digest push to users
// whose local time is 8am, whose digest isn't done, and who haven't opted out.
// Spec: work/praxis/notifications-spec-final-2026-09-10.md (Ada, approved by Ayuka).

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-praxis-cron-secret',
};

const TARGET_LOCAL_HOUR = 8;
const FALLBACK_TIMEZONE = 'America/New_York';

// The digest day is keyed to New York everywhere in the app.
function nyDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(d);
}

function localHour(timezone: string): number {
  try {
    return Number(
      new Intl.DateTimeFormat('en-US', { timeZone: timezone, hour: 'numeric', hourCycle: 'h23' }).format(new Date())
    );
  } catch {
    return -1; // bad timezone string — skip rather than spam at a wrong hour
  }
}

function daysBetween(fromKey: string, toKey: string): number {
  return Math.round((Date.parse(toKey) - Date.parse(fromKey)) / 86400000);
}

async function chunkedExpoSend(messages: unknown[]): Promise<void> {
  for (let i = 0; i < messages.length; i += 100) {
    await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

// One line for everyone, generated once per day from the digest's top stories.
async function getOrCreateDigestLine(supabase: ReturnType<typeof createClient>, today: string): Promise<string> {
  const fallback = '5 stories, 6 minutes.';
  const { data: cached } = await supabase
    .from('push_log')
    .select('meta')
    .eq('push_type', 'digest')
    .gte('sent_at', `${today}T00:00:00Z`)
    .not('meta->>line', 'is', null)
    .limit(1);
  if (cached && cached.length > 0) return (cached[0].meta as { line: string }).line;

  try {
    const digestRes = await fetch(
      `${Deno.env.get('SUPABASE_URL')}/functions/v1/get-or-create-daily-digest`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')}`,
        },
        body: JSON.stringify({}),
      }
    );
    const digest = await digestRes.json();
    const titles: string[] = (digest?.articles ?? digest?.data?.articles ?? [])
      .map((a: { title?: string; headline?: string }) => a?.title ?? a?.headline)
      .filter(Boolean)
      .slice(0, 5);
    if (titles.length < 3) return fallback;

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) return fallback;
    const aiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${openaiKey}` },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 60,
        messages: [
          {
            role: 'user',
            content:
              `Turn these headlines into ONE line naming the three biggest stories as short noun phrases, comma-separated. No verbs, no adjectives, no quotes, max 110 characters total.\n\n${titles.join('\n')}`,
          },
        ],
      }),
    });
    const ai = await aiRes.json();
    const line = ai?.choices?.[0]?.message?.content?.trim();
    return line && line.length <= 120 ? line : fallback;
  } catch {
    return fallback;
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  const secret = Deno.env.get('PRAXIS_CRON_SECRET');
  if (secret && req.headers.get('x-praxis-cron-secret') !== secret) {
    return new Response(JSON.stringify({ error: 'forbidden' }), {
      status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    const today = nyDateKey();

    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('user_id, token, timezone');
    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Users with at least one device currently at the target local hour.
    // Guest devices (no account yet) get the same morning push, sent blind —
    // their reading lives on-device, so there is no completion state to check.
    const byUser = new Map<string, string[]>();
    const guestTokens: string[] = [];
    for (const t of tokens) {
      if (localHour(t.timezone ?? FALLBACK_TIMEZONE) !== TARGET_LOCAL_HOUR) continue;
      if (!t.user_id) {
        guestTokens.push(t.token);
        continue;
      }
      const list = byUser.get(t.user_id) ?? [];
      list.push(t.token);
      byUser.set(t.user_id, list);
    }
    if (byUser.size === 0 && guestTokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const userIds = [...byUser.keys()];

    const { data: profiles } = userIds.length > 0
      ? await supabase
          .from('profiles')
          .select('id, notify_digest, streak_last_completed_date')
          .in('id', userIds)
      : { data: [] };

    // Recent push history for lapse rules + dedupe (14 days is enough for every rule).
    const since = new Date(Date.now() - 14 * 86400000).toISOString();
    const { data: recentPushes } = userIds.length > 0
      ? await supabase
          .from('push_log')
          .select('user_id, push_type, sent_at')
          .in('user_id', userIds)
          .gte('sent_at', since)
      : { data: [] };

    const pushesFor = (uid: string, type: string) =>
      (recentPushes ?? []).filter((p) => p.user_id === uid && p.push_type === type);

    const line = await getOrCreateDigestLine(supabase, today);

    const messages: unknown[] = [];
    const logRows: unknown[] = [];

    for (const p of profiles ?? []) {
      if (p.notify_digest === false) continue;
      if (p.streak_last_completed_date === today) continue; // today's digest already done

      const digestPushes = pushesFor(p.id, 'digest');
      const sentToday = digestPushes.some((x) => nyDateKey(new Date(x.sent_at)) === today);
      if (sentToday) continue;

      const lastDone = p.streak_last_completed_date as string | null;
      const daysSilent = lastDone ? daysBetween(lastDone, today) : null;

      // 7 days without a completed digest: daily pushes stop. One win-back on day 8.
      if (daysSilent !== null && daysSilent > 7) {
        const winbacks = pushesFor(p.id, 'winback');
        const winbackSinceLapse = winbacks.some(
          (x) => lastDone && nyDateKey(new Date(x.sent_at)) > lastDone
        );
        if (daysSilent === 8 && !winbackSinceLapse) {
          for (const token of byUser.get(p.id)!) {
            messages.push({
              to: token,
              title: 'Praxis',
              body: "Your feed's been busy. 5 stories whenever you're back.",
              data: { type: 'digest' },
              sound: 'default',
            });
          }
          logRows.push({ user_id: p.id, push_type: 'winback', meta: {} });
        }
        continue;
      }

      // Morning push pauses after 3 consecutive ignored days (pushed, never completed).
      const lastThreeDays = [1, 2, 3].map((n) => nyDateKey(new Date(Date.now() - n * 86400000)));
      const ignoredThree = lastThreeDays.every((day) =>
        digestPushes.some((x) => nyDateKey(new Date(x.sent_at)) === day)
      ) && (!lastDone || lastDone < lastThreeDays[2]);
      if (ignoredThree) continue;

      for (const token of byUser.get(p.id)!) {
        messages.push({
          to: token,
          title: 'Your Daily Digest is ready',
          body: line,
          data: { type: 'digest' },
          sound: 'default',
        });
      }
      logRows.push({ user_id: p.id, push_type: 'digest', meta: { line } });
    }

    // Guest devices: one generic line, once a day at their local 8am.
    // No per-user log row (no user), and the hourly window is the dedupe.
    for (const token of guestTokens) {
      messages.push({
        to: token,
        title: 'Your Daily Digest is ready',
        body: line,
        data: { type: 'digest' },
        sound: 'default',
      });
    }

    if (messages.length > 0) {
      await chunkedExpoSend(messages);
      if (logRows.length > 0) {
        await supabase.from('push_log').insert(logRows);
      }
    }

    return new Response(JSON.stringify({ sent: messages.length, users: logRows.length, guests: guestTokens.length }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
