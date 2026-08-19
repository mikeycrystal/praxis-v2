import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import {
  getRecommenderConfig,
  getRecommenderHeaders,
} from './recommenderConfig';
import {
  getMockTopicsData,
  getMockTrendingTopics,
} from './mockPreviewData';

export interface TopicRecord {
  id: number;
  name: string;
}

export interface TopicsData {
  seedTopics: TopicRecord[];
  allTopics: TopicRecord[];
}

export interface TrendingTopic {
  id: number;
  name: string;
  cluster_count: number;
  max_cluster_size: number;
}

export const TOPICS_CACHE_KEY = 'praxis.topicsCache.v1';
export const TRENDING_TOPICS_CACHE_KEY = 'praxis.trendingTopicsCache.v1';

let cachedTopicsInMemory: TopicsData | undefined;
let cachedTrendingTopicsInMemory: TrendingTopic[] | undefined;
let topicsRequest: Promise<TopicsData> | undefined;
let trendingTopicsRequest: Promise<TrendingTopic[]> | undefined;

// Keep graph discovery data on the same backend default as the feed/recommendation
// path so mobile topic/trending state does not silently drift to hardcoded
// fallbacks while the feed itself is using the live recommender service.
const getHeaders = () => ({
  'Content-Type': 'application/json',
  ...getRecommenderHeaders(),
});

export const readCachedTopics = (): TopicsData | undefined => {
  if (Platform.OS !== 'web') return cachedTopicsInMemory;

  try {
    const raw = window.sessionStorage.getItem(TOPICS_CACHE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as {
      seedTopics?: unknown;
      allTopics?: unknown;
    };

    if (!Array.isArray(parsed.seedTopics) || !Array.isArray(parsed.allTopics)) {
      return undefined;
    }

    const topics = {
      seedTopics: parsed.seedTopics as TopicRecord[],
      allTopics: parsed.allTopics as TopicRecord[],
    };
    cachedTopicsInMemory = topics;
    return topics;
  } catch (error) {
    console.warn('[discoveryData] Failed to read cached topics', error);
    return undefined;
  }
};

export const writeCachedTopics = (topics: TopicsData) => {
  cachedTopicsInMemory = topics;

  if (Platform.OS !== 'web') {
    void AsyncStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(topics)).catch((error) => {
      console.warn('[discoveryData] Failed to cache topics', error);
    });
    return;
  }

  try {
    window.sessionStorage.setItem(TOPICS_CACHE_KEY, JSON.stringify(topics));
  } catch (error) {
    console.warn('[discoveryData] Failed to cache topics', error);
  }
};

export const fetchTopics = async (): Promise<TopicsData> => {
  if (topicsRequest) return topicsRequest;

  topicsRequest = (async () => {
  const { apiBaseUrl, isEnabled } = getRecommenderConfig();
  if (!isEnabled || !apiBaseUrl) {
    const mockTopics = getMockTopicsData();
    writeCachedTopics(mockTopics);
    return mockTopics;
  }

  const response = await fetch(`${apiBaseUrl}/v1/topics`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch topics: ${response.status}`);
  }

  const data = await response.json();
  const topics = {
    seedTopics: data.seed_topics as TopicRecord[],
    allTopics: data.all_topics as TopicRecord[],
  };
  writeCachedTopics(topics);
  return topics;
  })();

  try {
    return await topicsRequest;
  } finally {
    topicsRequest = undefined;
  }
};

export const readCachedTrendingTopics = (): TrendingTopic[] | undefined => {
  if (Platform.OS !== 'web') return cachedTrendingTopicsInMemory;

  try {
    const raw = window.sessionStorage.getItem(TRENDING_TOPICS_CACHE_KEY);
    if (!raw) return undefined;

    const parsed = JSON.parse(raw) as unknown;
    const topics = Array.isArray(parsed) ? (parsed as TrendingTopic[]) : undefined;
    cachedTrendingTopicsInMemory = topics;
    return topics;
  } catch (error) {
    console.warn('[discoveryData] Failed to read cached trending topics', error);
    return undefined;
  }
};

export const writeCachedTrendingTopics = (topics: TrendingTopic[]) => {
  cachedTrendingTopicsInMemory = topics;

  if (Platform.OS !== 'web') {
    void AsyncStorage.setItem(TRENDING_TOPICS_CACHE_KEY, JSON.stringify(topics)).catch((error) => {
      console.warn('[discoveryData] Failed to cache trending topics', error);
    });
    return;
  }

  try {
    window.sessionStorage.setItem(
      TRENDING_TOPICS_CACHE_KEY,
      JSON.stringify(topics),
    );
  } catch (error) {
    console.warn('[discoveryData] Failed to cache trending topics', error);
  }
};

export const fetchTrendingTopics = async (): Promise<TrendingTopic[]> => {
  if (trendingTopicsRequest) return trendingTopicsRequest;

  trendingTopicsRequest = (async () => {
  const { apiBaseUrl, isEnabled } = getRecommenderConfig();
  if (!isEnabled || !apiBaseUrl) {
    const mockTopics = getMockTrendingTopics();
    writeCachedTrendingTopics(mockTopics);
    return mockTopics;
  }

  const response = await fetch(`${apiBaseUrl}/v1/trending-topics`, {
    method: 'GET',
    headers: getHeaders(),
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch trending topics: ${response.status}`);
  }

  const data = await response.json();
  const topics = data.topics as TrendingTopic[];
  writeCachedTrendingTopics(topics);
  return topics;
  })();

  try {
    return await trendingTopicsRequest;
  } finally {
    trendingTopicsRequest = undefined;
  }
};

export const hydrateDiscoveryCache = async () => {
  if (Platform.OS === 'web') return {
    topics: readCachedTopics(),
    trendingTopics: readCachedTrendingTopics(),
  };

  try {
    const [storedTopics, storedTrendingTopics] = await AsyncStorage.multiGet([
      TOPICS_CACHE_KEY,
      TRENDING_TOPICS_CACHE_KEY,
    ]);

    if (storedTopics[1]) {
      const parsed = JSON.parse(storedTopics[1]) as TopicsData;
      if (Array.isArray(parsed.seedTopics) && Array.isArray(parsed.allTopics)) {
        cachedTopicsInMemory = parsed;
      }
    }
    if (storedTrendingTopics[1]) {
      const parsed = JSON.parse(storedTrendingTopics[1]) as unknown;
      if (Array.isArray(parsed)) cachedTrendingTopicsInMemory = parsed as TrendingTopic[];
    }
  } catch (error) {
    console.warn('[discoveryData] Failed to hydrate native cache', error);
  }

  return {
    topics: cachedTopicsInMemory,
    trendingTopics: cachedTrendingTopicsInMemory,
  };
};
