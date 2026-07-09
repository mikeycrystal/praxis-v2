export interface MockPreviewArticle {
  id: number;
  title: string;
  lede: string;
  image_url: string;
  url: string;
  ts_pub: string;
  x: number;
  y: number;
  publisher: string;
  source: string;
  category: 'business' | 'tech' | 'environment' | 'sports' | 'world';
  topics: string[];
  reasons?: string[];
}

export interface MockGraphFilter {
  position: { x: number; y: number };
  radius: number;
}

const DEFAULT_LIMIT = 20;

export const SAFE_MODE_TOPIC_NAMES = [
  'Artificial Intelligence',
  'Business',
  'Civil Rights',
  'Climate Policy',
  'Congress',
  'Courts',
  'Crime',
  'Culture',
  'Cybersecurity',
  'Economy',
  'Economy, Business & Markets',
  'Education',
  'Elections',
  'Energy',
  'Environment',
  'Executive Branch',
  'Foreign Policy',
  'Health',
  'Immigration Policy',
  'International Politics',
  'Labor',
  'Local Government',
  'Markets',
  'Media',
  'National Politics',
  'National Security',
  'Other',
  'Politics & Governance',
  'Public Policy',
  'Real Estate',
  'Religion',
  'Science',
  'Science, Technology & Environment',
  'Society, Culture & Public Life',
  'Space',
  'State Politics',
  'Technology',
  'Trade',
];

export const MOCK_PREVIEW_ARTICLES: MockPreviewArticle[] = [
  {
    id: 900001,
    title: 'Trump warns Israel, Iran to "not blow" emerging peace deal',
    lede: 'The White House urged restraint as diplomats worked to preserve a fragile regional ceasefire.',
    image_url: 'https://images.unsplash.com/photo-1541872703-74c5e44368f9?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/trump-israel-iran',
    ts_pub: '2026-06-22T18:30:00.000Z',
    x: 6,
    y: 58,
    publisher: 'The Hill',
    source: 'The Hill',
    category: 'world',
    topics: ['U.S.-Iran Diplomacy', 'Foreign Policy', 'International Politics'],
  },
  {
    id: 900002,
    title: 'Senators split on the next AI oversight package as business groups push back',
    lede: 'A bipartisan framework is advancing, but disagreements remain over audits, transparency rules, and model access.',
    image_url: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/ai-oversight-package',
    ts_pub: '2026-06-22T16:10:00.000Z',
    x: -2,
    y: 44,
    publisher: 'Politico',
    source: 'Politico',
    category: 'tech',
    topics: ['Artificial Intelligence', 'Technology', 'Congress', 'Business'],
  },
  {
    id: 900003,
    title: 'Fed watchers brace for a slower summer as bond markets price in caution',
    lede: 'Investors are rethinking the pace of cuts while officials point to sticky services inflation.',
    image_url: 'https://images.unsplash.com/photo-1520607162513-77705c0f0d4a?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/fed-bond-market-caution',
    ts_pub: '2026-06-22T14:05:00.000Z',
    x: 24,
    y: 34,
    publisher: 'The Wall Street Journal',
    source: 'WSJ',
    category: 'business',
    topics: ['Economy', 'Markets', 'Business'],
  },
  {
    id: 900004,
    title: 'Fox commentators frame border debate around local enforcement and election stakes',
    lede: 'Coverage tied state-level crackdowns to the broader campaign narrative heading into the fall.',
    image_url: 'https://images.unsplash.com/photo-1529074963764-98f45c47344b?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/border-debate-election-stakes',
    ts_pub: '2026-06-22T13:10:00.000Z',
    x: 58,
    y: 20,
    publisher: 'Fox News',
    source: 'Fox News',
    category: 'world',
    topics: ['Immigration', 'Elections', 'Politics & Governance'],
  },
  {
    id: 900005,
    title: 'Breitbart focuses on campus unrest after court blocks a state protest ban',
    lede: 'The outlet cast the ruling as another flashpoint in the fight over public order and free speech.',
    image_url: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/campus-unrest-court-ruling',
    ts_pub: '2026-06-21T21:00:00.000Z',
    x: 70,
    y: -4,
    publisher: 'Breitbart',
    source: 'Breitbart',
    category: 'world',
    topics: ['Courts', 'Culture', 'Civil Rights'],
  },
  {
    id: 900006,
    title: 'Climate and energy talks revive after utilities agree to a narrower emissions timetable',
    lede: 'Negotiators say the compromise could unlock stalled state-level infrastructure funding.',
    image_url: 'https://images.unsplash.com/photo-1473448912268-2022ce9509d8?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/climate-energy-talks',
    ts_pub: '2026-06-22T12:20:00.000Z',
    x: -18,
    y: 30,
    publisher: 'Reuters',
    source: 'Reuters',
    category: 'environment',
    topics: ['Climate', 'Energy', 'Environment', 'Public Policy'],
  },
  {
    id: 900007,
    title: 'New labor data complicates the political message on wage growth',
    lede: 'Fresh numbers show hiring cooling in some regions even as pay gains hold in service industries.',
    image_url: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/labor-data-wage-growth',
    ts_pub: '2026-06-22T10:55:00.000Z',
    x: -38,
    y: 16,
    publisher: 'CNN',
    source: 'CNN',
    category: 'business',
    topics: ['Labor', 'Economy', 'Elections'],
  },
  {
    id: 900008,
    title: 'New York Times examines the quiet coalition shaping AI safety standards',
    lede: 'Researchers, civil society groups, and former officials are converging on a stricter baseline for deployment.',
    image_url: 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/nyt-ai-safety-coalition',
    ts_pub: '2026-06-22T09:25:00.000Z',
    x: -10,
    y: 48,
    publisher: 'New York Times',
    source: 'New York Times',
    category: 'tech',
    topics: ['Artificial Intelligence', 'Technology', 'Science'],
  },
  {
    id: 900009,
    title: 'The Atlantic frames the election around institutional trust and civic fatigue',
    lede: 'Its latest cover story argues that disengagement, not polarization alone, is distorting public life.',
    image_url: 'https://images.unsplash.com/photo-1494172961521-33799ddd43a5?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/atlantic-institutional-trust',
    ts_pub: '2026-06-21T18:40:00.000Z',
    x: -26,
    y: -34,
    publisher: 'The Atlantic',
    source: 'The Atlantic',
    category: 'world',
    topics: ['Culture', 'Elections', 'Politics & Governance'],
  },
  {
    id: 900010,
    title: 'National Review criticizes the administration’s latest tech trade compromise',
    lede: 'Writers argued the deal weakens leverage while doing little to stabilize strategic supply chains.',
    image_url: 'https://images.unsplash.com/photo-1518186285589-2f7649de83e0?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/tech-trade-compromise',
    ts_pub: '2026-06-21T17:15:00.000Z',
    x: 48,
    y: -36,
    publisher: 'National Review',
    source: 'National Review',
    category: 'business',
    topics: ['Trade', 'Technology', 'National Security'],
  },
  {
    id: 900011,
    title: 'Vox breaks down why education funding fights are spreading beyond big cities',
    lede: 'District budget shortfalls and enrollment shifts are driving a broader reset in school politics.',
    image_url: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/education-funding-fights',
    ts_pub: '2026-06-21T16:50:00.000Z',
    x: -54,
    y: 22,
    publisher: 'Vox',
    source: 'Vox',
    category: 'world',
    topics: ['Education', 'Local Government', 'Public Policy'],
  },
  {
    id: 900012,
    title: 'MSNBC emphasizes rights questions in the latest surveillance expansion debate',
    lede: 'Guests and anchors focused on court scrutiny, privacy, and the electoral implications of renewed powers.',
    image_url: 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?auto=format&fit=crop&w=1200&q=80',
    url: 'https://example.com/praxis-preview/surveillance-expansion-debate',
    ts_pub: '2026-06-21T15:45:00.000Z',
    x: -56,
    y: 32,
    publisher: 'MSNBC',
    source: 'MSNBC',
    category: 'world',
    topics: ['Civil Rights', 'National Security', 'Courts'],
  },
];

const normalizeTopic = (topic: string) => topic.trim().toLowerCase();

const TOPIC_STOPWORDS = new Set([
  'and',
  'or',
  'the',
  'of',
  'for',
  'to',
  'in',
  'on',
  'policy',
  'politics',
  'governance',
  'public',
  'other',
]);

const uniqueTopicNames = (topics: string[]) => {
  const seen = new Set<string>();
  const ordered: string[] = [];

  topics.forEach((topic) => {
    const normalized = normalizeTopic(topic);
    if (!normalized || seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(topic);
  });

  return ordered;
};

const tokenizeQuery = (value: string) =>
  value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter((token) => token.length >= 3);

const tokenizeTopic = (value: string) =>
  tokenizeQuery(value).filter((token) => !TOPIC_STOPWORDS.has(token));

const buildKeywordSet = (terms: string[]) => {
  const keywords = new Set<string>();

  terms.forEach((term) => {
    tokenizeQuery(term).forEach((token) => {
      keywords.add(token);
    });
  });

  return keywords;
};

const scoreTopicPair = (requestedTopic: string, articleTopic: string) => {
  const normalizedRequested = normalizeTopic(requestedTopic);
  const normalizedArticle = normalizeTopic(articleTopic);

  if (normalizedRequested === normalizedArticle) {
    return 4;
  }

  const requestedTokens = tokenizeTopic(requestedTopic);
  const articleTokens = tokenizeTopic(articleTopic);

  if (requestedTokens.length === 0 || articleTokens.length === 0) {
    return 0;
  }

  const requestedSet = new Set(requestedTokens);
  const articleSet = new Set(articleTokens);

  let overlap = 0;
  requestedSet.forEach((token) => {
    if (articleSet.has(token)) {
      overlap += 1;
    }
  });

  if (overlap === 0) {
    return 0;
  }

  const requestedCoverage = overlap / requestedSet.size;
  const articleCoverage = overlap / articleSet.size;

  if (requestedCoverage === 1 || articleCoverage === 1) {
    return 3 + overlap * 0.25;
  }

  return overlap;
};

const scoreArticleForTopics = (article: MockPreviewArticle, topics: string[]) => {
  if (topics.length === 0) return 0;

  return topics.reduce((score, requestedTopic) => {
    const bestTopicMatch = article.topics.reduce((best, articleTopic) => (
      Math.max(best, scoreTopicPair(requestedTopic, articleTopic))
    ), 0);

    return score + bestTopicMatch;
  }, 0);
};

const scoreArticleForKeywords = (article: MockPreviewArticle, terms: string[]) => {
  if (terms.length === 0) return 0;

  const keywords = buildKeywordSet(terms);
  if (keywords.size === 0) return 0;

  const text = [
    article.title,
    article.lede,
    article.publisher,
    article.source,
    ...article.topics,
    ...(article.reasons ?? []),
  ]
    .join(' ')
    .toLowerCase();

  let score = 0;
  keywords.forEach((keyword) => {
    if (text.includes(keyword)) {
      score += 1;
    }
  });

  return score;
};

const scoreArticleForGraph = (
  article: MockPreviewArticle,
  graphFilter?: MockGraphFilter | null,
) => {
  if (!graphFilter) return 0;
  const dx = article.x - graphFilter.position.x;
  const dy = article.y - graphFilter.position.y;
  const distance = Math.hypot(dx, dy);
  const radius = Math.max(graphFilter.radius, 10);
  const withinRadius = distance <= radius;
  return withinRadius ? 1000 - distance : -distance * 2;
};

const rankArticles = (
  articles: MockPreviewArticle[],
  options?: {
    topics?: string[];
    promptTerms?: string[];
    graphFilter?: MockGraphFilter | null;
    excludeArticleIds?: number[];
    limit?: number;
  },
) => {
  const topics = options?.topics?.filter(Boolean) ?? [];
  const promptTerms = options?.promptTerms?.filter(Boolean) ?? [];
  const graphFilter = options?.graphFilter ?? null;
  const excludeIds = new Set(options?.excludeArticleIds ?? []);
  const limit = options?.limit ?? DEFAULT_LIMIT;

  return [...articles]
    .filter((article) => !excludeIds.has(article.id))
    .map((article) => ({
      article,
      topicScore: scoreArticleForTopics(article, topics),
      keywordScore: scoreArticleForKeywords(article, promptTerms),
      graphScore: scoreArticleForGraph(article, graphFilter),
      publishedAt: new Date(article.ts_pub).getTime(),
    }))
    .sort((left, right) => {
      if (left.topicScore !== right.topicScore) {
        return right.topicScore - left.topicScore;
      }
      if (left.keywordScore !== right.keywordScore) {
        return right.keywordScore - left.keywordScore;
      }
      if (left.graphScore !== right.graphScore) {
        return right.graphScore - left.graphScore;
      }
      return right.publishedAt - left.publishedAt;
    })
    .slice(0, limit)
    .map(({ article }) => article);
};

export const getMockTopicsData = () => ({
  seedTopics: uniqueTopicNames([
    ...SAFE_MODE_TOPIC_NAMES,
    ...MOCK_PREVIEW_ARTICLES.flatMap((article) => article.topics),
  ]).map((name, index) => ({
    id: index + 1,
    name,
  })),
  allTopics: uniqueTopicNames([
    ...SAFE_MODE_TOPIC_NAMES,
    ...MOCK_PREVIEW_ARTICLES.flatMap((article) => article.topics),
  ]).map((name, index) => ({
    id: index + 1,
    name,
  })),
});

export const getMockTrendingTopics = () => {
  const now = Date.now();
  const topicScores = new Map<string, { name: string; score: number; count: number }>();

  MOCK_PREVIEW_ARTICLES.forEach((article) => {
    const publishedAt = new Date(article.ts_pub).getTime();
    const ageHours = Math.max(1, (now - publishedAt) / (1000 * 60 * 60));
    const recencyBoost = 1 / ageHours;

    article.topics.forEach((topic, topicIndex) => {
      const normalized = normalizeTopic(topic);
      const current = topicScores.get(normalized);
      const topicScore = 1.2 - topicIndex * 0.08 + recencyBoost * 6;

      if (current) {
        current.score += topicScore;
        current.count += 1;
        return;
      }

      topicScores.set(normalized, {
        name: topic,
        score: topicScore,
        count: 1,
      });
    });
  });

  return [...topicScores.values()]
    .sort((left, right) => {
      if (left.count !== right.count) {
        return right.count - left.count;
      }
      return right.score - left.score;
    })
    .slice(0, 8)
    .map((topic, index) => ({
      id: index + 1,
      name: topic.name,
      cluster_count: Math.max(1, topic.count),
      max_cluster_size: Math.max(4, Math.round(topic.score)),
    }));
};

export const SAFE_MODE_TRENDING_TOPIC_NAMES = getMockTrendingTopics().map(
  (topic) => topic.name,
);

export const getMockTopNewsArticles = (
  graphFilter?: MockGraphFilter | null,
  excludeArticleIds: number[] = [],
  limit = DEFAULT_LIMIT,
) => rankArticles(MOCK_PREVIEW_ARTICLES, { graphFilter, excludeArticleIds, limit });

export const getMockTopicArticles = (
  topics: string[] = [],
  excludeArticleIds: number[] = [],
  graphFilter?: MockGraphFilter | null,
  limit = DEFAULT_LIMIT,
  promptTerms: string[] = [],
) => {
  const rankedMatches = [...MOCK_PREVIEW_ARTICLES]
    .filter((article) => !excludeArticleIds.includes(article.id))
    .map((article) => ({
      article,
      topicScore: scoreArticleForTopics(article, topics),
      keywordScore: scoreArticleForKeywords(article, promptTerms),
      graphScore: scoreArticleForGraph(article, graphFilter),
      publishedAt: new Date(article.ts_pub).getTime(),
    }))
    .sort((left, right) => {
      if (left.topicScore !== right.topicScore) {
        return right.topicScore - left.topicScore;
      }
      if (left.keywordScore !== right.keywordScore) {
        return right.keywordScore - left.keywordScore;
      }
      if (left.graphScore !== right.graphScore) {
        return right.graphScore - left.graphScore;
      }
      return right.publishedAt - left.publishedAt;
    });

  const matched = rankedMatches
    .filter(({ topicScore, keywordScore }) => topicScore > 0 || keywordScore > 0)
    .slice(0, limit)
    .map(({ article }) => article);

  if (matched.length > 0) {
    return matched;
  }

  const fallbackRanked = rankArticles(MOCK_PREVIEW_ARTICLES, {
    topics,
    promptTerms,
    graphFilter,
    excludeArticleIds,
    limit,
  });

  if (fallbackRanked.length > 0) {
    return fallbackRanked;
  }

  return getMockTopNewsArticles(graphFilter, excludeArticleIds, limit);
};

export const getMockPersonalizedArticles = (
  topics: string[] = [],
  excludeArticleIds: number[] = [],
  limit = DEFAULT_LIMIT,
) => getMockTopicArticles(topics, excludeArticleIds, null, limit);
