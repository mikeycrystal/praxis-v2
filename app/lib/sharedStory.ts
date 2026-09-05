import { Platform } from 'react-native';
import type { Article } from '../hooks/useFeedArticles';
import { getRecommenderConfig, getRecommenderHeaders } from './recommenderConfig';
import { supabase } from '../services/supabase';

// A shared story link (praxismedia.us/story/ID, or praxis://story/ID) lands
// on app/story/[id].tsx, which records the request here and sends the user
// to the Feed. The Feed consumes the request and seats the article at the
// top of the deck as a guest card, the same handoff web performs in
// Index.tsx. Session-only, like the Daily Digest open request.
const SHARED_STORY_REQUEST_KEY = 'praxis.sharedStoryRequest.v1';
const memoryStorage = new Map<string, string>();

const readRaw = (): string | null => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    return window.sessionStorage.getItem(SHARED_STORY_REQUEST_KEY);
  }
  return memoryStorage.get(SHARED_STORY_REQUEST_KEY) ?? null;
};

const writeRaw = (value: string | null) => {
  if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
    if (value) window.sessionStorage.setItem(SHARED_STORY_REQUEST_KEY, value);
    else window.sessionStorage.removeItem(SHARED_STORY_REQUEST_KEY);
    return;
  }
  if (value) memoryStorage.set(SHARED_STORY_REQUEST_KEY, value);
  else memoryStorage.delete(SHARED_STORY_REQUEST_KEY);
};

export const writeSharedStoryRequest = (articleId: string | number) => {
  const id = Number(articleId);
  if (!Number.isFinite(id) || id <= 0) return;
  try {
    writeRaw(String(id));
  } catch (error) {
    console.warn('[sharedStory] Failed to write request', error);
  }
};

export const consumeSharedStoryRequest = (): number | null => {
  try {
    const raw = readRaw();
    if (!raw) return null;
    writeRaw(null);
    const id = Number(raw);
    return Number.isFinite(id) && id > 0 ? id : null;
  } catch (error) {
    console.warn('[sharedStory] Failed to read request', error);
    return null;
  }
};

type PublisherLike = string | { name?: string | null; domain?: string | null } | null | undefined;

const normalizePublisher = (value: PublisherLike): Article['publisher'] => {
  if (!value) return null;
  if (typeof value === 'string') return { name: value, domain: '' };
  return { name: value.name ?? '', domain: value.domain ?? '' };
};

const toArticle = (row: Record<string, any>, id: number): Article => ({
  id,
  title: row.title ?? 'Untitled article',
  lede: row.lede ?? null,
  image_url: row.image_url ?? null,
  url: row.url ?? '',
  ts_pub: row.ts_pub ?? new Date().toISOString(),
  x: typeof row.x === 'number' ? row.x : 0,
  y: typeof row.y === 'number' ? row.y : 0,
  publisher: normalizePublisher(row.publisher),
  topics: Array.isArray(row.meta?.topics) ? row.meta.topics : Array.isArray(row.topics) ? row.topics : [],
  category: row.category ?? undefined,
  meta: row.meta ?? null,
});

// Same two-step lookup as web's fetchStoryArticle: recommender backend
// first (it hydrates publisher/meta), Supabase article table as fallback.
export const fetchSharedStoryArticle = async (articleId: number): Promise<Article | null> => {
  const { apiBaseUrl, isEnabled } = getRecommenderConfig();
  if (isEnabled && apiBaseUrl) {
    try {
      const response = await fetch(`${apiBaseUrl.replace(/\/$/, '')}/v1/articles/${articleId}`, {
        headers: getRecommenderHeaders(),
      });
      if (response.ok) {
        const payload = await response.json();
        if (payload?.article) return toArticle(payload.article, articleId);
      }
    } catch (error) {
      console.warn('[sharedStory] Recommender lookup failed', error);
    }
  }

  try {
    const { data, error } = await supabase
      .from('article')
      .select('id, title, lede, url, image_url, ts_pub, x, y, category, meta, publisher(name, domain)')
      .eq('id', articleId)
      .maybeSingle();
    if (error) throw error;
    return data ? toArticle(data as Record<string, any>, articleId) : null;
  } catch (error) {
    console.warn('[sharedStory] Supabase lookup failed', error);
    return null;
  }
};
