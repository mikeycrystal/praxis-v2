import { serve } from 'https://deno.land/std@0.177.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface ArticleRow {
  id: number;
  title: string;
  lede: string | null;
  body: string | null;
  category: string | null;
  publisher: { name: string } | null;
}

interface InsightsResult {
  summary: string;
  keyPoints: string[];
  sentiment: 'positive' | 'negative' | 'neutral' | 'excited';
  credibilityScore: number;
  entities: string[];
  relatedTopics: string[];
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { articleId } = await req.json();
    if (!articleId) {
      return new Response(JSON.stringify({ error: 'articleId required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Check cache first (in ai_insights table if it exists, else compute)
    const { data: cached } = await supabase
      .from('ai_insights')
      .select('*')
      .eq('article_id', articleId)
      .maybeSingle();

    if (cached) {
      return new Response(JSON.stringify(cached.insights), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Fetch article
    const { data: article, error: artErr } = await supabase
      .from('article')
      .select('id, title, lede, body, category, publisher(name)')
      .eq('id', articleId)
      .single();

    if (artErr || !article) {
      return new Response(JSON.stringify({ error: 'Article not found' }), {
        status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const art = article as unknown as ArticleRow;

    // Build prompt
    const content = [art.title, art.lede, art.body].filter(Boolean).join('\n\n').slice(0, 4000);
    const prompt = `Analyze this news article and return a JSON object with exactly these fields:
- summary: A 2-3 sentence plain-language summary
- keyPoints: An array of 3-5 bullet point strings (key takeaways)
- sentiment: One of "positive", "negative", "neutral", or "excited"
- credibilityScore: A number 0-100 estimating factual reliability (consider source reputation, use of evidence, specificity)
- entities: Array of up to 8 key named entities (people, organizations, places)
- relatedTopics: Array of 3-5 related topic tags

Article:
Title: ${art.title}
Publisher: ${art.publisher?.name ?? 'Unknown'}
Category: ${art.category ?? 'News'}

${content}

Return only valid JSON, no markdown.`;

    const openaiKey = Deno.env.get('OPENAI_API_KEY');
    if (!openaiKey) throw new Error('OPENAI_API_KEY not set');

    const openaiRes = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${openaiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.3,
        max_tokens: 800,
        response_format: { type: 'json_object' },
      }),
    });

    if (!openaiRes.ok) throw new Error(`OpenAI error: ${openaiRes.status}`);
    const openaiData = await openaiRes.json();
    const insights: InsightsResult = JSON.parse(openaiData.choices[0].message.content);

    // Cache result (best-effort — table may not exist yet)
    await supabase.from('ai_insights').upsert({ article_id: articleId, insights }).catch(() => {});

    return new Response(JSON.stringify(insights), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
