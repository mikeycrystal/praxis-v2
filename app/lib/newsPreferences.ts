export interface GraphPoint {
  x: number;
  y: number;
}

export interface TopNewsGraphFilterState {
  position: GraphPoint;
  radius: number;
}

export interface ActiveQueryState {
  topics: string[];
  promptTerms: string[];
}

export interface RecommendationRequestState {
  prompt: string;
  topics: string[];
  position: { x: number; y: number };
  radius: number;
  exclude_article_ids?: number[];
}

export interface DigestPreset {
  id: string;
  name: string;
  topics: string[];
  position: GraphPoint;
  radius: number;
  createdAt: number;
}

export interface FeedPreferenceSignatureInput {
  activeQuery: ActiveQueryState | null;
  recommendationRequest: RecommendationRequestState | null;
  topNewsGraphFilter: TopNewsGraphFilterState | null;
  isTopNewsActive: boolean;
  profileTopics?: string[];
}

export const DEFAULT_GRAPH_POSITION: GraphPoint = {
  x: 0,
  y: 0,
};

export const DEFAULT_GRAPH_RADIUS = 25;
export const TOP_NEWS_GRAPH_FILTER_STORAGE_KEY = 'praxis.topNewsGraphFilter.v1';
export const ACTIVE_QUERY_STORAGE_KEY = 'activeQuery';
export const RECOMMENDATION_REQUEST_STORAGE_KEY = 'recommendationRequest';
export const TOP_NEWS_ACTIVE_STORAGE_KEY = 'isTopNewsActive';

const MEMORY_STORE_KEY = '__PRAXIS_NEWS_PREFERENCES_STORE__';

const getMemoryStore = () => {
  const scope = globalThis as typeof globalThis & {
    [MEMORY_STORE_KEY]?: Record<string, string>;
  };

  if (!scope[MEMORY_STORE_KEY]) {
    scope[MEMORY_STORE_KEY] = {};
  }

  if (typeof window !== 'undefined') {
    (window as typeof window & { __PRAXIS_NEWS_PREFERENCES_STORE__?: Record<string, string> }).__PRAXIS_NEWS_PREFERENCES_STORE__ =
      scope[MEMORY_STORE_KEY];
  }

  return scope[MEMORY_STORE_KEY]!;
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const isFiniteNumber = (value: unknown): value is number =>
  typeof value === 'number' && Number.isFinite(value);

const getStorageBackend = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    // Match the webapp's behavior: query/top-news state should persist during
    // in-app navigation, but reset with the browsing session instead of
    // lingering indefinitely across future visits.
    if (window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch (error) {
    console.warn('Session storage is unavailable', error);
  }

  try {
    if (window.localStorage) {
      return window.localStorage;
    }
  } catch (error) {
    console.warn('Local storage is unavailable', error);
  }

  return null;
};

const readStoredString = (key: string): string | null => {
  const storage = getStorageBackend();

  if (storage) {
    try {
      return storage.getItem(key);
    } catch (error) {
      console.warn(`Failed to read ${key} from localStorage`, error);
    }
  }

  const memoryStore = getMemoryStore();

  return Object.prototype.hasOwnProperty.call(memoryStore, key)
    ? memoryStore[key]
    : null;
};

const writeStoredString = (key: string, value: string) => {
  const storage = getStorageBackend();

  if (storage) {
    try {
      storage.setItem(key, value);
      return;
    } catch (error) {
      console.warn(`Failed to persist ${key} to localStorage`, error);
    }
  }

  const memoryStore = getMemoryStore();
  memoryStore[key] = value;
};

const removeStoredString = (key: string) => {
  const storage = getStorageBackend();

  if (storage) {
    try {
      storage.removeItem(key);
    } catch (error) {
      console.warn(`Failed to remove ${key} from localStorage`, error);
    }
  }

  const memoryStore = getMemoryStore();
  delete memoryStore[key];
};

const readStorageJson = <T,>(key: string): T | null => {
  const raw = readStoredString(key);
  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`Failed to parse ${key} from storage`, error);
    return null;
  }
};

const writeStorageJson = (key: string, value: unknown) => {
  try {
    writeStoredString(key, JSON.stringify(value));
  } catch (error) {
    console.warn(`Failed to persist ${key} to storage`, error);
  }
};

export const clearSessionKey = (key: string) => {
  try {
    removeStoredString(key);
  } catch (error) {
    console.warn(`Failed to remove ${key} from storage`, error);
  }
};

export const isDefaultGraphSelection = (
  position: GraphPoint,
  radius: number,
) =>
  position.x === DEFAULT_GRAPH_POSITION.x &&
  position.y === DEFAULT_GRAPH_POSITION.y &&
  radius === DEFAULT_GRAPH_RADIUS;

export const readTopNewsGraphFilter =
  (): TopNewsGraphFilterState | null => {
    const parsed = readStorageJson<{
      position?: { x?: unknown; y?: unknown };
      radius?: unknown;
    }>(TOP_NEWS_GRAPH_FILTER_STORAGE_KEY);

    if (
      !isFiniteNumber(parsed?.position?.x) ||
      !isFiniteNumber(parsed?.position?.y) ||
      !isFiniteNumber(parsed?.radius)
    ) {
      return null;
    }

    return {
      position: {
        x: clamp(Math.round(parsed.position.x), -100, 100),
        y: clamp(Math.round(parsed.position.y), -100, 100),
      },
      radius: clamp(Math.round(parsed.radius), 5, 100),
    };
  };

export const writeTopNewsGraphFilter = (
  filter: TopNewsGraphFilterState | null,
) => {
  if (!filter) {
    clearSessionKey(TOP_NEWS_GRAPH_FILTER_STORAGE_KEY);
    return;
  }

  writeStorageJson(TOP_NEWS_GRAPH_FILTER_STORAGE_KEY, filter);
};

export const readActiveQuery = (): ActiveQueryState | null => {
  const parsed = readStorageJson<{
    topics?: unknown;
    promptTerms?: unknown;
  }>(ACTIVE_QUERY_STORAGE_KEY);

  if (!parsed) return null;

  return {
    topics: Array.isArray(parsed?.topics)
      ? parsed.topics.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
    promptTerms: Array.isArray(parsed?.promptTerms)
      ? parsed.promptTerms.filter(
          (value): value is string => typeof value === 'string',
        )
      : [],
  };
};

export const writeActiveQuery = (query: ActiveQueryState | null) => {
  if (!query) {
    clearSessionKey(ACTIVE_QUERY_STORAGE_KEY);
    return;
  }

  writeStorageJson(ACTIVE_QUERY_STORAGE_KEY, query);
};

export const readRecommendationRequest =
  (): RecommendationRequestState | null => {
    const parsed = readStorageJson<{
      prompt?: unknown;
      topics?: unknown;
      position?: { x?: unknown; y?: unknown };
      radius?: unknown;
      exclude_article_ids?: unknown;
    }>(RECOMMENDATION_REQUEST_STORAGE_KEY);

    if (
      typeof parsed?.prompt !== 'string' ||
      !Array.isArray(parsed?.topics) ||
      !isFiniteNumber(parsed?.position?.x) ||
      !isFiniteNumber(parsed?.position?.y) ||
      !isFiniteNumber(parsed?.radius)
    ) {
      return null;
    }

    return {
      prompt: parsed.prompt,
      topics: parsed.topics.filter(
        (value): value is string => typeof value === 'string',
      ),
      position: {
        x: clamp(parsed.position.x, -1, 1),
        y: clamp(parsed.position.y, -1, 1),
      },
      radius: clamp(parsed.radius, 0.05, 1),
      exclude_article_ids: Array.isArray(parsed.exclude_article_ids)
        ? parsed.exclude_article_ids.filter(
            (value): value is number => typeof value === 'number',
          )
        : [],
    };
  };

export const writeRecommendationRequest = (
  request: RecommendationRequestState | null,
) => {
  if (!request) {
    clearSessionKey(RECOMMENDATION_REQUEST_STORAGE_KEY);
    return;
  }

  writeStorageJson(RECOMMENDATION_REQUEST_STORAGE_KEY, request);
};

export const readIsTopNewsActive = () => {
  try {
    const raw = readStoredString(TOP_NEWS_ACTIVE_STORAGE_KEY);
    return raw !== 'false';
  } catch (error) {
    console.warn('Failed to read Top News active state', error);
    return true;
  }
};

export const writeIsTopNewsActive = (isActive: boolean) => {
  try {
    writeStoredString(TOP_NEWS_ACTIVE_STORAGE_KEY, JSON.stringify(isActive));
  } catch (error) {
    console.warn('Failed to persist Top News active state', error);
  }
};

export const getDigestStorageKey = (userId: string | null) =>
  userId ? `news_digests_${userId}` : 'news_digests';

export const buildFeedPreferenceSignature = ({
  activeQuery,
  recommendationRequest,
  topNewsGraphFilter,
  isTopNewsActive,
  profileTopics = [],
}: FeedPreferenceSignatureInput) =>
  JSON.stringify({
    mode: isTopNewsActive
      ? 'top-news'
      : recommendationRequest
        ? 'query'
        : 'personalized',
    activeQuery: activeQuery
      ? {
          topics: [...activeQuery.topics],
          promptTerms: [...activeQuery.promptTerms],
        }
      : null,
    recommendationRequest: recommendationRequest
      ? {
          prompt: recommendationRequest.prompt,
          topics: [...recommendationRequest.topics],
          position: recommendationRequest.position,
          radius: recommendationRequest.radius,
        }
      : null,
    topNewsGraphFilter,
    profileTopics: [...profileTopics],
  });
