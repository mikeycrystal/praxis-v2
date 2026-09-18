import { serve } from "https://deno.land/std@0.177.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Runs every 20 minutes. It sends, in order: the local 6pm edition,
// high-consensus breaking news, then one-sided-coverage blind spots.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-praxis-cron-secret",
};

const FALLBACK_TIMEZONE = "America/New_York";
const BREAKING_MIN_PUBLISHERS = 5;
const BREAKING_MAX_AGE_HOURS = 4;
const BREAKING_MIN_SCORE = 1.7;
const SPLIT_MIN_PUBLISHERS = 3;
const SPLIT_MAX_AGE_HOURS = 12;
const SPLIT_MIN_SCORE = 1.5;
const DAILY_CAP = 4;

type Article = {
  article_id: string;
  cluster_id: number | string;
  publisher: string;
  title: string;
  ts_pub: string;
  score: number;
  x: number | null;
  cluster_summary: string;
};

type Cluster = {
  id: string;
  articles: Article[];
  publishers: Set<string>;
  newest: number;
  maxScore: number;
  lead: Article;
  xs: number[];
};

function nyDateKey(d = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York" })
    .format(d);
}

function localTime(timezone: string): { hour: number; minute: number } | null {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone,
      hour: "numeric",
      minute: "numeric",
      hourCycle: "h23",
    }).formatToParts(new Date());
    return {
      hour: Number(parts.find((p) => p.type === "hour")?.value),
      minute: Number(parts.find((p) => p.type === "minute")?.value),
    };
  } catch {
    return null; // bad timezone string — skip rather than send at the wrong time
  }
}

function trimTitle(title: string, max = 60): string {
  const clean = title.replace(/\s+/g, " ").trim();
  if (clean.length <= max) return clean;
  const cut = clean.slice(0, max - 1).replace(/[ ,;:–-]+\S*$/, "").trim();
  return `${cut || clean.slice(0, max - 1)}…`;
}

function withinHours(timestamp: number, hours: number): boolean {
  return Number.isFinite(timestamp) &&
    timestamp >= Date.now() - hours * 3600000;
}

function parseForcedTime(
  value: unknown,
): { hour: number; minute: number } | null {
  if (typeof value !== "string") return null;
  const match = /^(\d{1,2}):(\d{2})$/.exec(value);
  if (!match) return null;
  const hour = Number(match[1]);
  const minute = Number(match[2]);
  return hour <= 23 && minute <= 59 ? { hour, minute } : null;
}

async function chunkedExpoSend(messages: unknown[]): Promise<void> {
  for (let i = 0; i < messages.length; i += 100) {
    await fetch("https://exp.host/--/api/v2/push/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(messages.slice(i, i + 100)),
    });
  }
}

function groupClusters(articles: Article[]): Cluster[] {
  const grouped = new Map<string, Cluster>();
  for (const article of articles) {
    const id = String(article.cluster_id);
    const published = Date.parse(article.ts_pub);
    const current = grouped.get(id);
    if (current) {
      current.articles.push(article);
      current.publishers.add(article.publisher);
      current.newest = Math.max(current.newest, published);
      if (article.score > current.maxScore) {
        current.maxScore = article.score;
        current.lead = article;
      }
      if (typeof article.x === "number") current.xs.push(article.x);
      continue;
    }
    grouped.set(id, {
      id,
      articles: [article],
      publishers: new Set([article.publisher]),
      newest: published,
      maxScore: article.score,
      lead: article,
      xs: typeof article.x === "number" ? [article.x] : [],
    });
  }
  return [...grouped.values()];
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const secret = Deno.env.get("PRAXIS_CRON_SECRET");
  if (secret && req.headers.get("x-praxis-cron-secret") !== secret) {
    return new Response(JSON.stringify({ error: "forbidden" }), {
      status: 403,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  if (Deno.env.get("PRAXIS_NEWS_ENABLED") === "false") {
    return new Response(JSON.stringify({ skipped: "disabled" }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let forcedTime: { hour: number; minute: number } | null = null;
  let dry = Deno.env.get("PRAXIS_NEWS_DRY_RUN") === "true";
  try {
    const body = await req.json();
    // Test controls require the configured cron secret, just as the digest's do.
    if (secret && req.headers.get("x-praxis-cron-secret") === secret) {
      forcedTime = parseForcedTime(body?.force_local_time);
      if (body?.dry === true) dry = true;
    }
  } catch {
    // no/invalid body — the normal cron case
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const apiBase = (Deno.env.get("RECOMMENDER_API_URL") ?? "").replace(
      /\/$/,
      "",
    );
    const feedResponse = await fetch(`${apiBase}/v1/fallback-articles`, {
      headers: { "X-API-Key": Deno.env.get("RECOMMENDER_API_KEY") ?? "" },
    });
    if (!feedResponse.ok) {
      throw new Error(
        `fallback articles request failed: ${feedResponse.status}`,
      );
    }
    const feed = await feedResponse.json();
    const clusters = groupClusters((feed?.articles ?? []) as Article[]);

    const { data: tokens } = await supabase
      .from("push_tokens")
      .select("user_id, token, timezone");
    if (!tokens || tokens.length === 0) {
      return new Response(
        JSON.stringify({
          sent: 0,
          news: 0,
          breaking: 0,
          split: 0,
          guests: 0,
          dry,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    const eveningByUser = new Map<string, string[]>();
    const activeByUser = new Map<string, string[]>();
    const guestTokens: string[] = [];
    for (const token of tokens) {
      const time = forcedTime ?? localTime(token.timezone ?? FALLBACK_TIMEZONE);
      if (!time) continue;
      const evening = time.hour === 18 && time.minute < 20;
      const quiet = time.hour >= 22 || time.hour <= 6;
      if (!token.user_id) {
        if (evening) guestTokens.push(token.token);
        continue;
      }
      if (evening) {
        const list = eveningByUser.get(token.user_id) ?? [];
        list.push(token.token);
        eveningByUser.set(token.user_id, list);
      }
      if (!quiet) {
        const list = activeByUser.get(token.user_id) ?? [];
        list.push(token.token);
        activeByUser.set(token.user_id, list);
      }
    }

    const userIds = [
      ...new Set([...eveningByUser.keys(), ...activeByUser.keys()]),
    ];
    const { data: profiles } = userIds.length > 0
      ? await supabase.from("profiles").select("id, notify_news").in(
        "id",
        userIds,
      )
      : { data: [] };
    const since48h = new Date(Date.now() - 48 * 3600000).toISOString();
    const { data: recentPushes } = userIds.length > 0
      ? await supabase
        .from("push_log")
        .select("user_id, push_type, sent_at, meta")
        .in("user_id", userIds)
        .gte("sent_at", since48h)
      : { data: [] };
    const { data: alertedRows } = await supabase
      .from("push_log")
      .select("meta->>cluster_id")
      .not("meta->>cluster_id", "is", null)
      .limit(10000);
    const alertedClusters = new Set(
      (alertedRows ?? []).map((row) =>
        String(
          (row as Record<string, unknown>).cluster_id ??
            (row as Record<string, unknown>)["meta->>cluster_id"],
        )
      ),
    );

    const today = nyDateKey();
    const messages: unknown[] = [];
    const logRows: Array<
      { user_id: string; push_type: string; meta: Record<string, unknown> }
    > = [];
    let news = 0;
    let breaking = 0;
    let split = 0;
    let guests = 0;

    const mine = (userId: string) =>
      (recentPushes ?? []).filter((row) => row.user_id === userId);
    const sentToday = (rows: typeof recentPushes, type: string) =>
      (rows ?? []).some((row) =>
        row.push_type === type && nyDateKey(new Date(row.sent_at)) === today
      );
    const sentWithin = (
      rows: typeof recentPushes,
      type: string,
      hours: number,
    ) =>
      (rows ?? []).some((row) =>
        row.push_type === type &&
        Date.now() - Date.parse(row.sent_at) < hours * 3600000
      );
    const dailyCapped = (userId: string, rows: typeof recentPushes) =>
      (rows ?? []).filter((row) =>
            ["digest", "streak", "news", "breaking", "split"].includes(
              row.push_type,
            ) &&
            nyDateKey(new Date(row.sent_at)) === today
          ).length +
          logRows.filter((row) =>
            row.user_id === userId &&
            ["digest", "streak", "news", "breaking", "split"].includes(
              row.push_type,
            )
          ).length >= DAILY_CAP;

    const eveningCandidates = clusters
      .filter((cluster) =>
        cluster.maxScore >= 1.5 && withinHours(cluster.newest, 12)
      )
      .sort((a, b) => b.maxScore - a.maxScore);

    // 1. Evening edition: users see two fresh clusters not sent to them in 48 hours.
    for (const profile of profiles ?? []) {
      const userTokens = eveningByUser.get(profile.id);
      if (!userTokens || profile.notify_news === false) continue;
      if (sentToday(mine(profile.id), "news")) continue;
      // Both stories of a past edition count as "already seen".
      const recentClusters = new Set<string>();
      for (const row of mine(profile.id)) {
        const meta = (row.meta ?? {}) as Record<string, unknown>;
        if (meta.cluster_id != null) recentClusters.add(String(meta.cluster_id));
        if (meta.cluster_id_2 != null) recentClusters.add(String(meta.cluster_id_2));
      }
      const selected = eveningCandidates.filter((cluster) =>
        !recentClusters.has(cluster.id)
      ).slice(0, 2);
      if (selected.length < 2) continue;
      const [first, second] = selected;
      const line = `${trimTitle(first.lead.title)}; ${
        trimTitle(second.lead.title)
      }`;
      for (const token of userTokens) {
        messages.push({
          to: token,
          title: "This evening",
          body: line,
          data: {
            type: "news",
            articleId: first.lead.article_id,
            clusterId: first.lead.cluster_id,
          },
          sound: "default",
        });
        news += 1;
      }
      logRows.push({
        user_id: profile.id,
        push_type: "news",
        meta: {
          slot: "evening",
          cluster_id: first.lead.cluster_id,
          cluster_id_2: second.lead.cluster_id,
          article_id: first.lead.article_id,
          line,
        },
      });
    }
    if (eveningCandidates.length >= 2) {
      const [first, second] = eveningCandidates;
      const line = `${trimTitle(first.lead.title)}; ${
        trimTitle(second.lead.title)
      }`;
      for (const token of guestTokens) {
        messages.push({
          to: token,
          title: "This evening",
          body: line,
          data: {
            type: "news",
            articleId: first.lead.article_id,
            clusterId: first.lead.cluster_id,
          },
          sound: "default",
        });
        news += 1;
        guests += 1;
      }
    }

    // 2. Breaking: a new, broad, high-score cluster, no more than once per user per day.
    const breakingCluster = clusters
      .filter((cluster) =>
        cluster.publishers.size >= BREAKING_MIN_PUBLISHERS &&
        withinHours(cluster.newest, BREAKING_MAX_AGE_HOURS) &&
        cluster.maxScore >= BREAKING_MIN_SCORE &&
        !alertedClusters.has(cluster.id)
      )
      .sort((a, b) =>
        b.publishers.size - a.publishers.size || b.maxScore - a.maxScore
      )[0];
    if (breakingCluster) {
      for (const profile of profiles ?? []) {
        const userTokens = activeByUser.get(profile.id);
        const rows = mine(profile.id);
        if (
          !userTokens || profile.notify_news === false ||
          dailyCapped(profile.id, rows) || sentWithin(rows, "breaking", 24)
        ) continue;
        const hasRecentDigest = rows.some((row) =>
          row.push_type === "digest" &&
          Date.now() - Date.parse(row.sent_at) < 2 * 3600000
        );
        if (hasRecentDigest) continue;
        const line = breakingCluster.lead.title.slice(0, 140);
        for (const token of userTokens) {
          messages.push({
            to: token,
            title: "Breaking",
            body: line,
            data: {
              type: "breaking",
              articleId: breakingCluster.lead.article_id,
              clusterId: breakingCluster.lead.cluster_id,
            },
            sound: "default",
          });
          breaking += 1;
        }
        logRows.push({
          user_id: profile.id,
          push_type: "breaking",
          meta: {
            cluster_id: breakingCluster.lead.cluster_id,
            article_id: breakingCluster.lead.article_id,
            publishers: breakingCluster.publishers.size,
            line,
          },
        });
      }
      alertedClusters.add(breakingCluster.id);
    }

    // 3. Blind spot: a new cluster covered only by publishers on one side.
    const splitCluster = clusters
      .map((cluster) => ({
        cluster,
        side: cluster.articles.length === cluster.xs.length &&
            cluster.xs.every((x) => x <= -0.3)
          ? "left"
          : cluster.articles.length === cluster.xs.length &&
              cluster.xs.every((x) => x >= 0.3)
          ? "right"
          : null,
      }))
      .filter(({ cluster, side }) =>
        cluster.publishers.size >= SPLIT_MIN_PUBLISHERS && side !== null &&
        withinHours(cluster.newest, SPLIT_MAX_AGE_HOURS) &&
        cluster.maxScore >= SPLIT_MIN_SCORE &&
        !alertedClusters.has(cluster.id)
      )
      .sort((a, b) =>
        b.cluster.publishers.size - a.cluster.publishers.size ||
        b.cluster.maxScore - a.cluster.maxScore
      )[0];
    if (splitCluster?.side) {
      const { cluster, side } = splitCluster;
      const missingSide = side === "left" ? "right" : "left";
      const line = `${
        trimTitle(cluster.lead.title, 90)
      } · Covered on the ${side}, not the ${missingSide} (so far).`;
      for (const profile of profiles ?? []) {
        const userTokens = activeByUser.get(profile.id);
        const rows = mine(profile.id);
        if (
          !userTokens || profile.notify_news === false ||
          dailyCapped(profile.id, rows) || sentToday(rows, "split")
        ) continue;
        for (const token of userTokens) {
          messages.push({
            to: token,
            title: "Blind spot",
            body: line,
            data: {
              type: "split",
              articleId: cluster.lead.article_id,
              clusterId: cluster.lead.cluster_id,
            },
            sound: "default",
          });
          split += 1;
        }
        logRows.push({
          user_id: profile.id,
          push_type: "split",
          meta: {
            cluster_id: cluster.lead.cluster_id,
            article_id: cluster.lead.article_id,
            side,
            line,
          },
        });
      }
    }

    // A dry run sends nothing AND logs nothing: a logged dry row would count
    // as "already sent" for dedupe, caps, and the alerted-cluster set, and
    // silently block the next real send. The would-be rows come back in the
    // response instead.
    if (!dry) {
      if (messages.length > 0) await chunkedExpoSend(messages);
      if (logRows.length > 0) await supabase.from("push_log").insert(logRows);
    }

    return new Response(
      JSON.stringify({
        sent: dry ? 0 : messages.length,
        news,
        breaking,
        split,
        guests,
        dry,
        ...(dry ? { preview: logRows, wouldSend: messages.length } : {}),
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
