import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const STORAGE_PREFIX = 'praxis.savedArticles.v1';

export interface SavedArticleSnapshot {
  id: number;
  title: string;
  lede: string;
  image_url: string | null;
  url: string;
  ts_pub: string;
  saved_at: string;
  publisher: {
    name: string;
    domain: string;
  } | null;
}

type SavedArticleInput = Partial<SavedArticleSnapshot> & {
  id: number;
  title?: string;
  lede?: string;
  image_url?: string | null;
  url?: string;
  ts_pub?: string;
  saved_at?: string;
  publisher?: {
    name?: string | null;
    domain?: string | null;
  } | null;
};

type SavedArticlesListener = (articles: SavedArticleSnapshot[]) => void;

const listeners = new Map<string, Set<SavedArticlesListener>>();
const memoryStorage = new Map<string, string>();

const buildStorageKey = (userId?: string | null) => `${STORAGE_PREFIX}:${userId ?? 'guest'}`;

const readStorageValue = async (key: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      return window.localStorage.getItem(key);
    }
    return memoryStorage.get(key) ?? null;
  }

  try {
    return await AsyncStorage.getItem(key);
  } catch (error) {
    console.warn('[savedArticles] Failed to read storage', error);
    return null;
  }
};

const writeStorageValue = async (key: string, value: string) => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && window.localStorage) {
      window.localStorage.setItem(key, value);
      return;
    }
    memoryStorage.set(key, value);
    return;
  }

  try {
    await AsyncStorage.setItem(key, value);
  } catch (error) {
    console.warn('[savedArticles] Failed to write storage', error);
  }
};

const normalizeSavedArticle = (article: SavedArticleInput): SavedArticleSnapshot | null => {
  const articleId = Number(article.id);
  if (!Number.isFinite(articleId) || articleId <= 0) return null;

  return {
    id: articleId,
    title: article.title?.trim() || 'Untitled',
    lede: article.lede?.trim() || '',
    image_url: article.image_url ?? null,
    url: article.url?.trim() || '',
    ts_pub: article.ts_pub || new Date().toISOString(),
    saved_at: article.saved_at || new Date().toISOString(),
    publisher: article.publisher?.name
      ? {
          name: article.publisher.name,
          domain: article.publisher.domain ?? '',
        }
      : null,
  };
};

const sortSavedArticles = (articles: SavedArticleSnapshot[]) =>
  [...articles].sort((left, right) =>
    new Date(right.saved_at).getTime() - new Date(left.saved_at).getTime(),
  );

const emitSavedArticles = (storageKey: string, articles: SavedArticleSnapshot[]) => {
  const scopedListeners = listeners.get(storageKey);
  if (!scopedListeners?.size) return;

  const snapshot = sortSavedArticles(articles);
  scopedListeners.forEach((listener) => listener(snapshot));
};

export const readSavedArticles = async (userId?: string | null): Promise<SavedArticleSnapshot[]> => {
  const storageKey = buildStorageKey(userId);
  const raw = await readStorageValue(storageKey);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return sortSavedArticles(
      parsed
        .map((article) => normalizeSavedArticle(article))
        .filter((article): article is SavedArticleSnapshot => Boolean(article)),
    );
  } catch (error) {
    console.warn('[savedArticles] Failed to parse saved articles', error);
    return [];
  }
};

export const writeSavedArticles = async (
  userId: string | null | undefined,
  articles: SavedArticleSnapshot[],
) => {
  const storageKey = buildStorageKey(userId);
  const normalized = sortSavedArticles(
    articles
      .map((article) => normalizeSavedArticle(article))
      .filter((article): article is SavedArticleSnapshot => Boolean(article)),
  );

  await writeStorageValue(storageKey, JSON.stringify(normalized));
  emitSavedArticles(storageKey, normalized);
};

export const upsertSavedArticle = async (
  userId: string | null | undefined,
  article: SavedArticleInput,
) => {
  const normalized = normalizeSavedArticle(article);
  if (!normalized) return [];

  const existing = await readSavedArticles(userId);
  const next = sortSavedArticles([
    normalized,
    ...existing.filter((current) => current.id !== normalized.id),
  ]);

  await writeSavedArticles(userId, next);
  return next;
};

export const removeSavedArticle = async (
  userId: string | null | undefined,
  articleId: number,
) => {
  const existing = await readSavedArticles(userId);
  const next = existing.filter((article) => article.id !== articleId);
  await writeSavedArticles(userId, next);
  return next;
};

export const mergeSavedArticles = async (
  userId: string | null | undefined,
  articles: SavedArticleInput[],
) => {
  const existing = await readSavedArticles(userId);
  const merged = new Map<number, SavedArticleSnapshot>();

  existing.forEach((article) => {
    merged.set(article.id, article);
  });

  articles.forEach((article) => {
    const normalized = normalizeSavedArticle(article);
    if (!normalized) return;

    const current = merged.get(normalized.id);
    merged.set(normalized.id, {
      ...current,
      ...normalized,
      saved_at: normalized.saved_at || current?.saved_at || new Date().toISOString(),
      publisher: normalized.publisher || current?.publisher || null,
    });
  });

  const next = sortSavedArticles(Array.from(merged.values()));
  await writeSavedArticles(userId, next);
  return next;
};

export const subscribeSavedArticles = (
  userId: string | null | undefined,
  listener: SavedArticlesListener,
) => {
  const storageKey = buildStorageKey(userId);
  const scopedListeners = listeners.get(storageKey) ?? new Set<SavedArticlesListener>();
  scopedListeners.add(listener);
  listeners.set(storageKey, scopedListeners);

  return () => {
    const nextListeners = listeners.get(storageKey);
    if (!nextListeners) return;
    nextListeners.delete(listener);
    if (nextListeners.size === 0) {
      listeners.delete(storageKey);
    }
  };
};
