import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Called via Supabase Webhook when a row is inserted into the `follows` table.
// Payload shape: { type: 'INSERT', record: { follower_id, following_id } }
serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const payload = await req.json();
    const { follower_id, following_id } = payload.record ?? payload;

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get follower's display name
    const { data: follower } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', follower_id)
      .single();

    const followerName = follower?.full_name ?? follower?.username ?? 'Someone';

    // Get push tokens for the person being followed
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', following_id);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Send Expo push notifications
    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      title: 'New Follower',
      body: `${followerName} started following you`,
      data: { type: 'follow', followerId: follower_id },
      sound: 'default',
    }));

    const expoRes = await fetch('https://exp.host/--/api/v2/push/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(messages),
    });

    const result = await expoRes.json();
    return new Response(JSON.stringify({ sent: tokens.length, result }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
