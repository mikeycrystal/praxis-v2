import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { senderId, recipientId, message } = await req.json();
    if (!senderId || !recipientId || !message) {
      return new Response(JSON.stringify({ error: 'senderId, recipientId, message required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get sender's display name
    const { data: sender } = await supabase
      .from('profiles')
      .select('full_name, username')
      .eq('id', senderId)
      .single();

    const senderName = sender?.full_name ?? sender?.username ?? 'Someone';

    // Get recipient's push tokens
    const { data: tokens } = await supabase
      .from('push_tokens')
      .select('token')
      .eq('user_id', recipientId);

    if (!tokens || tokens.length === 0) {
      return new Response(JSON.stringify({ sent: 0 }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const messages = tokens.map(({ token }: { token: string }) => ({
      to: token,
      title: senderName,
      body: message.length > 80 ? message.slice(0, 77) + '...' : message,
      data: { type: 'message', senderId },
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
