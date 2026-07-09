import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  ActiveQueryState,
  readActiveQuery,
  readIsTopNewsActive,
  readRecommendationRequest,
  readTopNewsGraphFilter,
  RecommendationRequestState,
  TopNewsGraphFilterState,
  writeActiveQuery,
  writeIsTopNewsActive,
  writeRecommendationRequest,
  writeTopNewsGraphFilter,
} from '../lib/newsPreferences';

interface NewsPreferencesState {
  activeQuery: ActiveQueryState | null;
  recommendationRequest: RecommendationRequestState | null;
  topNewsGraphFilter: TopNewsGraphFilterState | null;
  isTopNewsActive: boolean;
  prefetchedQueryArticles: any[] | null;
  requestNonce: number;
}

interface NewsPreferencesContextValue {
  preferences: NewsPreferencesState;
  applyQueryPreferences: (params: {
    activeQuery: ActiveQueryState;
    recommendationRequest: RecommendationRequestState;
    prefetchedArticles?: any[] | null;
  }) => void;
  applyTopNewsPreferences: (filter: TopNewsGraphFilterState | null) => void;
  syncQueryState: (params: {
    activeQuery: ActiveQueryState;
    recommendationRequest: RecommendationRequestState;
    prefetchedArticles?: any[] | null;
  }) => void;
  syncCustomizeState: () => void;
  syncTopNewsFallbackState: (filter?: TopNewsGraphFilterState | null) => void;
  syncPersonalizedState: () => void;
  refreshPreferences: () => void;
}

const buildInitialPreferences = (): NewsPreferencesState => ({
  activeQuery: readActiveQuery(),
  recommendationRequest: readRecommendationRequest(),
  topNewsGraphFilter: readTopNewsGraphFilter(),
  isTopNewsActive: readIsTopNewsActive(),
  prefetchedQueryArticles: null,
  requestNonce: 0,
});

const buildDefaultPreferences = (): NewsPreferencesState => ({
  activeQuery: null,
  recommendationRequest: null,
  topNewsGraphFilter: null,
  isTopNewsActive: true,
  prefetchedQueryArticles: null,
  requestNonce: 0,
});

const NewsPreferencesContext = createContext<NewsPreferencesContextValue | null>(null);

export function NewsPreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<NewsPreferencesState>(() => buildDefaultPreferences());

  const refreshPreferences = () => {
    setPreferences((previous) => ({
      ...buildInitialPreferences(),
      requestNonce: previous.requestNonce,
    }));
  };

  useEffect(() => {
    refreshPreferences();
  }, []);

  const applyQueryPreferences = ({
    activeQuery,
    recommendationRequest,
    prefetchedArticles = null,
  }: {
    activeQuery: ActiveQueryState;
    recommendationRequest: RecommendationRequestState;
    prefetchedArticles?: any[] | null;
  }) => {
    writeTopNewsGraphFilter(null);
    writeActiveQuery(activeQuery);
    writeRecommendationRequest(recommendationRequest);
    writeIsTopNewsActive(false);

    setPreferences((previous) => ({
      activeQuery,
      recommendationRequest,
      topNewsGraphFilter: null,
      isTopNewsActive: false,
      prefetchedQueryArticles: prefetchedArticles,
      requestNonce: previous.requestNonce + 1,
    }));
  };

  const applyTopNewsPreferences = (filter: TopNewsGraphFilterState | null) => {
    writeActiveQuery(null);
    writeRecommendationRequest(null);
    writeTopNewsGraphFilter(filter);
    writeIsTopNewsActive(true);

    setPreferences((previous) => ({
      activeQuery: null,
      recommendationRequest: null,
      topNewsGraphFilter: filter,
      isTopNewsActive: true,
      prefetchedQueryArticles: null,
      requestNonce: previous.requestNonce + 1,
    }));
  };

  const syncQueryState = ({
    activeQuery,
    recommendationRequest,
    prefetchedArticles = null,
  }: {
    activeQuery: ActiveQueryState;
    recommendationRequest: RecommendationRequestState;
    prefetchedArticles?: any[] | null;
  }) => {
    writeTopNewsGraphFilter(null);
    writeActiveQuery(activeQuery);
    writeRecommendationRequest(recommendationRequest);
    writeIsTopNewsActive(false);

    setPreferences((previous) => ({
      ...previous,
      activeQuery,
      recommendationRequest,
      topNewsGraphFilter: null,
      isTopNewsActive: false,
      prefetchedQueryArticles: prefetchedArticles,
    }));
  };

  const syncCustomizeState = () => {
    writeActiveQuery(null);
    writeRecommendationRequest(null);
    writeIsTopNewsActive(false);

    setPreferences((previous) => ({
      ...previous,
      activeQuery: null,
      recommendationRequest: null,
      isTopNewsActive: false,
      prefetchedQueryArticles: null,
    }));
  };

  const syncTopNewsFallbackState = (
    filter: TopNewsGraphFilterState | null = null,
  ) => {
    writeActiveQuery(null);
    writeRecommendationRequest(null);
    writeTopNewsGraphFilter(filter);
    writeIsTopNewsActive(true);

    setPreferences((previous) => ({
      ...previous,
      activeQuery: null,
      recommendationRequest: null,
      topNewsGraphFilter: filter,
      isTopNewsActive: true,
      prefetchedQueryArticles: null,
    }));
  };

  const syncPersonalizedState = () => {
    writeActiveQuery(null);
    writeRecommendationRequest(null);
    writeTopNewsGraphFilter(null);
    writeIsTopNewsActive(false);

    setPreferences((previous) => ({
      ...previous,
      activeQuery: null,
      recommendationRequest: null,
      topNewsGraphFilter: null,
      isTopNewsActive: false,
      prefetchedQueryArticles: null,
    }));
  };

  const value = useMemo(
    () => ({
      preferences,
      applyQueryPreferences,
      applyTopNewsPreferences,
      syncQueryState,
      syncCustomizeState,
      syncTopNewsFallbackState,
      syncPersonalizedState,
      refreshPreferences,
    }),
    [preferences],
  );

  return (
    <NewsPreferencesContext.Provider value={value}>
      {children}
    </NewsPreferencesContext.Provider>
  );
}

export const useNewsPreferences = () => {
  const context = useContext(NewsPreferencesContext);
  if (!context) {
    throw new Error('useNewsPreferences must be used within NewsPreferencesProvider');
  }
  return context;
};
