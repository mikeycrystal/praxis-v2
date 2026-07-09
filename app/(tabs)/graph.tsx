import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Pressable, PanResponder, Alert, Image as RNImage, useWindowDimensions } from 'react-native';
import Svg, { Circle, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';
import { Ionicons } from '@expo/vector-icons';
import { router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNewsPreferences } from '../context/NewsPreferencesContext';
import {
  ActiveQueryState,
  DEFAULT_GRAPH_POSITION,
  DEFAULT_GRAPH_RADIUS,
  DigestPreset,
  getDigestStorageKey,
  GraphPoint,
  isDefaultGraphSelection,
  readActiveQuery,
  readRecommendationRequest,
  readTopNewsGraphFilter,
  RecommendationRequestState,
  TopNewsGraphFilterState,
  writeTopNewsGraphFilter,
} from '../lib/newsPreferences';
import {
  fetchTopics,
  fetchTrendingTopics,
  readCachedTopics,
  readCachedTrendingTopics,
} from '../lib/discoveryData';
import {
  getMockTopicArticles,
  SAFE_MODE_TOPIC_NAMES,
  SAFE_MODE_TRENDING_TOPIC_NAMES,
} from '../lib/mockPreviewData';
import { getRecommenderConfig } from '../lib/recommenderConfig';

const logoAp = require('../../assets/logos/ap.png');
const logoAtlantic = require('../../assets/logos/atlantic.png');
const logoBbc = require('../../assets/logos/bbc.png');
const logoBreitbart = require('../../assets/logos/breitbart.png');
const logoCnn = require('../../assets/logos/cnn.png');
const logoFox = require('../../assets/logos/fox.png');
const logoMsnbc = require('../../assets/logos/msnbc.png');
const logoNr = require('../../assets/logos/nr.png');
const logoNyt = require('../../assets/logos/nyt.png');
const logoPolitico = require('../../assets/logos/politico.png');
const logoReuters = require('../../assets/logos/reuters.png');
const logoVox = require('../../assets/logos/vox.png');
const logoWsj = require('../../assets/logos/wsj.png');
const logoUri = (module: number | string | { uri?: string } | undefined) => {
  if (!module) return '';
  if (typeof module === 'string') return module;
  if (typeof module === 'object' && typeof module.uri === 'string') return module.uri;
  if (typeof RNImage.resolveAssetSource === 'function') {
    return RNImage.resolveAssetSource(module as number)?.uri ?? '';
  }
  return '';
};

const GRAPH_MIN_SIZE = 220;
const GRAPH_MAX_SIZE = 540;
const FALLBACK_GRAPH_SIZE = 320;

const PAGE = {
  background: '#F7F3EA',
  border: '#E7DEC9',
  text: '#2E2A25',
  textMuted: '#8A847C',
  textSoft: '#AAA39A',
  green: '#8DAE73',
  greenSoft: '#E8EFDB',
  orangeSoft: '#F9E6D6',
  chipBorder: '#DDD4C5',
  sliderTrack: '#E5DED4',
};

const FALLBACK_TOPICS = SAFE_MODE_TOPIC_NAMES;
const FALLBACK_TRENDING_TOPICS = SAFE_MODE_TRENDING_TOPIC_NAMES;

const OUTLETS = [
  { key: 'reuters', gx: 0, gy: 76, dx: -12, dy: -2, label: 'Reuters', logo: logoReuters, logoWeb: logoUri(logoReuters), width: 34, height: 12, labelDy: 11, blend: true },
  { key: 'ap', gx: 6, gy: 72, dx: 10, dy: -2, label: 'AP', logo: logoAp, logoWeb: logoUri(logoAp), width: 30, height: 18, labelDy: 11, blend: true },
  { key: 'bbc', gx: -2, gy: 64, dx: -4, dy: 10, label: 'BBC', logo: logoBbc, logoWeb: logoUri(logoBbc), width: 30, height: 12, labelDy: 11, blend: true },
  { key: 'nyt', gx: -14, gy: 50, dx: -10, dy: -6, label: 'New York Times', logo: logoNyt, logoWeb: logoUri(logoNyt), width: 42, height: 42, labelDy: 12 },
  { key: 'politico', gx: -2, gy: 44, dx: 10, dy: 10, label: 'Politico', logo: logoPolitico, logoWeb: logoUri(logoPolitico), width: 38, height: 10, labelDy: 10, blend: true },
  { key: 'wsj', gx: 22, gy: 42, dx: 10, dy: -6, label: 'WSJ', logo: logoWsj, logoWeb: logoUri(logoWsj), width: 34, height: 34, labelDy: 10, blend: true },
  { key: 'cnn', gx: -18, gy: 34, dx: -10, dy: 2, label: 'CNN', logo: logoCnn, logoWeb: logoUri(logoCnn), width: 34, height: 18, labelDy: 11, blend: true },
  { key: 'fox', gx: 50, gy: 28, dx: 14, dy: -4, label: 'Fox News', logo: logoFox, logoWeb: logoUri(logoFox), width: 34, height: 34, labelDy: 10, blend: true },
  { key: 'msnbc', gx: -50, gy: 38, dx: -18, dy: -8, label: 'MSNBC', logo: logoMsnbc, logoWeb: logoUri(logoMsnbc), width: 28, height: 16, labelDy: 10, blend: true },
  { key: 'vox', gx: -50, gy: 24, dx: -14, dy: 10, label: 'Vox', logo: logoVox, logoWeb: logoUri(logoVox), width: 34, height: 22, labelDy: 11, blend: true },
  { key: 'breitbart', gx: 60, gy: -2, dx: 18, dy: -6, label: 'Breitbart', logo: logoBreitbart, logoWeb: logoUri(logoBreitbart), width: 32, height: 22, labelDy: 10, blend: true },
  { key: 'atlantic', gx: -20, gy: -36, dx: -8, dy: -4, label: 'The Atlantic', logo: logoAtlantic, logoWeb: logoUri(logoAtlantic), width: 28, height: 34, labelDy: 12, blend: true },
  { key: 'nr', gx: 46, gy: -38, dx: 10, dy: 6, label: 'National Review', logo: logoNr, logoWeb: logoUri(logoNr), width: 34, height: 16, labelDy: 10, blend: true },
];

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const graphToSvg = (graphValue: number, size: number) => ((graphValue + 100) / 200) * size;
const normalizeTopicId = (value: string) => value.trim().toLowerCase();
const topicToTestId = (topic: string) =>
  topic
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
const topicIdToLabel = (topicId: string, topics: string[]) => {
  const exactTopic = topics.find((topic) => normalizeTopicId(topic) === topicId);
  if (exactTopic) return exactTopic;

  return topicId
    .split(/[-_]/g)
    .filter(Boolean)
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(' ');
};
const normalizeArticleCoordinate = (value?: number) => {
  if (typeof value !== 'number' || !Number.isFinite(value)) return 0;
  if (Math.abs(value) <= 1) return value;
  return clamp(value / 100, -1, 1);
};
const getPoliticalLeanLabel = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Political Lean';
  if (value <= -0.6) return 'Left';
  if (value <= -0.2) return 'Center Left';
  if (value < 0.2) return 'Center';
  if (value < 0.6) return 'Center Right';
  return 'Right';
};
const getReportingTypeLabel = (value?: number) => {
  if (typeof value !== 'number' || Number.isNaN(value)) return 'Reporting Type';
  if (value <= -0.45) return 'Opinion';
  if (value < 0.2) return 'Mixed';
  return 'Hard News';
};
const graphPointToCanvas = (point: GraphPoint, width: number, height: number) => ({
  x: ((point.x + 100) / 200) * width,
  y: ((100 - point.y) / 200) * height,
});
const canvasToGraphPoint = (x: number, y: number, width: number, height: number): GraphPoint => ({
  x: clamp(Math.round(((x / width) * 200) - 100), -100, 100),
  y: clamp(Math.round(100 - ((y / height) * 200)), -100, 100),
});

interface GraphPreferencesSeed {
  activeQuery: ActiveQueryState | null;
  recommendationRequest: RecommendationRequestState | null;
  topNewsGraphFilter: TopNewsGraphFilterState | null;
}

interface InitialGraphState {
  selectedTopics: string[];
  promptTerms: string[];
  hasAppliedTopNewsFilter: boolean;
  graphPosition: GraphPoint;
  radius: number;
}

interface PrefetchedQueryArticle {
  id: number;
  title: string;
  lede: string;
  image_url: string;
  url: string;
  ts_pub: string;
  x: number;
  y: number;
  publisher: {
    name: string;
    domain: string;
  } | null;
  topics: string[];
  source: string;
  category: 'business' | 'tech' | 'environment' | 'sports' | 'world';
  meta: {
    summary?: string;
    x_explanation?: string;
    y_explanation?: string;
    topics: string[];
  };
  reasons?: string[];
}

const DEFAULT_INITIAL_GRAPH_STATE: InitialGraphState = {
  selectedTopics: [],
  promptTerms: [],
  hasAppliedTopNewsFilter: false,
  graphPosition: DEFAULT_GRAPH_POSITION,
  radius: DEFAULT_GRAPH_RADIUS,
};

const buildInitialGraphState = ({
  activeQuery,
  recommendationRequest,
  topNewsGraphFilter,
}: GraphPreferencesSeed): InitialGraphState => {
  const savedQuery = activeQuery;
  const savedRecommendation = recommendationRequest;
  const savedTopNewsGraphFilter = topNewsGraphFilter;

  const selectedTopics = (savedQuery?.topics || []).map(normalizeTopicId);
  const promptTerms = savedQuery?.promptTerms || [];

  if (
    savedRecommendation &&
    typeof savedRecommendation.position?.x === 'number' &&
    typeof savedRecommendation.position?.y === 'number' &&
    typeof savedRecommendation.radius === 'number'
  ) {
    return {
      selectedTopics,
      promptTerms,
      hasAppliedTopNewsFilter: false,
      graphPosition: {
        x: Math.round(savedRecommendation.position.x * 100),
        y: Math.round(savedRecommendation.position.y * 100),
      },
      radius: Math.round(savedRecommendation.radius * 100),
    };
  }

  if (savedTopNewsGraphFilter) {
    return {
      selectedTopics,
      promptTerms,
      hasAppliedTopNewsFilter:
        selectedTopics.length === 0 && promptTerms.length === 0,
      graphPosition: savedTopNewsGraphFilter.position,
      radius: savedTopNewsGraphFilter.radius,
    };
  }

  return {
    selectedTopics,
    promptTerms,
    hasAppliedTopNewsFilter: false,
    graphPosition: DEFAULT_GRAPH_POSITION,
    radius: DEFAULT_GRAPH_RADIUS,
  };
};

const buildSafeModePrefetchedArticles = ({
  topics,
  promptTerms,
  position,
  radius,
}: {
  topics: string[];
  promptTerms: string[];
  position: GraphPoint;
  radius: number;
}): PrefetchedQueryArticle[] =>
  getMockTopicArticles(
    topics,
    [],
    {
      position,
      radius,
    },
    20,
    promptTerms,
  ).map((article) => {
    const normalizedX = normalizeArticleCoordinate(article.x);
    const normalizedY = normalizeArticleCoordinate(article.y);

    return {
      id: article.id,
      title: article.title,
      lede: article.lede,
      image_url: article.image_url,
      url: article.url,
      ts_pub: article.ts_pub,
      x: normalizedX,
      y: normalizedY,
      publisher: article.publisher
        ? {
            name: article.publisher,
            domain: '',
          }
        : null,
      topics: article.topics,
      source: article.source,
      category: article.category,
      meta: {
        summary: article.lede,
        x_explanation: `${article.source} approaches ${(article.topics[0] || 'this story').toLowerCase()} from a ${getPoliticalLeanLabel(normalizedX).toLowerCase()} vantage point, highlighting the tradeoffs and actors it sees as most important.`,
        y_explanation: `${article.source} presents ${(article.topics[1] || article.topics[0] || 'the news cycle').toLowerCase()} in a ${getReportingTypeLabel(normalizedY).toLowerCase()} style, shaping whether the piece feels more interpretive or more straight-news.`,
        topics: article.topics,
      },
      reasons: [
        `${article.publisher} coverage`,
        `${article.category} context`,
        article.topics[0] ? `${article.topics[0]} relevance` : null,
      ].filter((value): value is string => Boolean(value)),
    };
  });

export default function GraphScreen() {
  const { user, profile } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const {
    preferences,
    applyQueryPreferences,
    applyTopNewsPreferences,
  } = useNewsPreferences();
  const isFocused = useIsFocused();
  const [graphViewport, setGraphViewport] = useState({ width: 0, height: 0 });
  const graphWidth = useMemo(() => {
    const fallbackWidth = Math.min(
      Math.max(windowWidth - 88, GRAPH_MIN_SIZE),
      GRAPH_MAX_SIZE,
    );
    const viewportHeightLimit = Math.min(
      Math.max(windowHeight - 430, GRAPH_MIN_SIZE),
      GRAPH_MAX_SIZE,
    );
    const availableWidth = Math.max(graphViewport.width - 36, 0);
    const availableHeight = Math.max(
      Math.min(graphViewport.height - 56, viewportHeightLimit),
      0,
    );
    const availableSquare = Math.min(
      availableWidth || fallbackWidth,
      availableHeight || viewportHeightLimit || fallbackWidth,
    );

    return Math.min(
      Math.max(availableSquare || FALLBACK_GRAPH_SIZE, GRAPH_MIN_SIZE),
      GRAPH_MAX_SIZE,
    );
  }, [graphViewport.height, graphViewport.width, windowHeight, windowWidth]);
  const graphHeight = graphWidth;
  const centerX = graphWidth / 2;
  const centerY = graphHeight / 2;
  const readPersistedGraphState = useCallback(
    () =>
      buildInitialGraphState({
        activeQuery: readActiveQuery(),
        recommendationRequest: readRecommendationRequest(),
        topNewsGraphFilter: readTopNewsGraphFilter(),
      }),
    [],
  );
  const [initialGraphState] = useState<InitialGraphState>(() => DEFAULT_INITIAL_GRAPH_STATE);
  const searchInputRef = useRef<TextInput | null>(null);
  const dropdownCloseTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const initialPin = graphPointToCanvas(
    initialGraphState.graphPosition,
    graphWidth,
    graphHeight,
  );

  const [search, setSearch] = useState('');
  const [selectedTopics, setSelectedTopics] = useState<string[]>(
    () => initialGraphState.selectedTopics,
  );
  const [promptTerms, setPromptTerms] = useState<string[]>(
    () => initialGraphState.promptTerms,
  );
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);
  const [showSaveDialog, setShowSaveDialog] = useState(false);
  const [showSignInDialog, setShowSignInDialog] = useState(false);
  const [digestName, setDigestName] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [isTopicsLoading, setIsTopicsLoading] = useState(false);
  const [seedTopics, setSeedTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [allTopics, setAllTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [trendingTopics, setTrendingTopics] = useState<string[]>(FALLBACK_TRENDING_TOPICS);
  const [digests, setDigests] = useState<DigestPreset[]>([]);
  const [radius, setRadius] = useState(initialGraphState.radius / 100);
  const [hasAppliedTopNewsFilter, setHasAppliedTopNewsFilter] = useState(
    () => initialGraphState.hasAppliedTopNewsFilter,
  );
  const radiusPx = radius * (graphWidth * 0.32);
  const sliderTrackWidth = Math.min(Math.max(windowWidth - 210, 160), 240);
  const [pinX, setPinX] = useState(initialPin.x);
  const [pinY, setPinY] = useState(initialPin.y);
  const graphDragActive = useRef(false);
  const graphPositionRef = useRef<GraphPoint>(initialGraphState.graphPosition);
  const previousGraphSizeRef = useRef({
    width: graphWidth,
    height: graphHeight,
  });
  const currentGraphPosition = useMemo(
    () => canvasToGraphPoint(pinX, pinY, graphWidth, graphHeight),
    [pinX, pinY, graphWidth, graphHeight],
  );
  const [initialState, setInitialState] = useState({
    topics: initialGraphState.selectedTopics,
    promptTerms: initialGraphState.promptTerms,
    position: initialGraphState.graphPosition,
    radius: initialGraphState.radius,
  });

  const syncGraphStateFromPreferences = useCallback(() => {
    const nextGraphState = readPersistedGraphState();
    const nextPin = graphPointToCanvas(
      nextGraphState.graphPosition,
      graphWidth,
      graphHeight,
    );

    setSelectedTopics(nextGraphState.selectedTopics);
    setPromptTerms(nextGraphState.promptTerms);
    setPinX(nextPin.x);
    setPinY(nextPin.y);
    setRadius(nextGraphState.radius / 100);
    setHasAppliedTopNewsFilter(nextGraphState.hasAppliedTopNewsFilter);
    setInitialState({
      topics: nextGraphState.selectedTopics,
      promptTerms: nextGraphState.promptTerms,
      position: nextGraphState.graphPosition,
      radius: nextGraphState.radius,
    });
    setSearch('');
    setIsDropdownOpen(false);
    setIsApplying(false);
  }, [graphHeight, graphWidth, readPersistedGraphState]);

  useFocusEffect(
    useCallback(() => {
      syncGraphStateFromPreferences();
    }, [syncGraphStateFromPreferences]),
  );

  useEffect(() => {
    if (isFocused) {
      return;
    }

    syncGraphStateFromPreferences();
  }, [
    isFocused,
    preferences.activeQuery,
    preferences.isTopNewsActive,
    preferences.recommendationRequest,
    preferences.requestNonce,
    preferences.topNewsGraphFilter,
    syncGraphStateFromPreferences,
  ]);

  useEffect(() => {
    if (!user?.id || typeof window === 'undefined') {
      setDigests([]);
      return;
    }

    try {
      const raw = window.localStorage.getItem(getDigestStorageKey(user.id));
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed)) {
          const normalizedDigests = parsed
            .map((digest: any) => {
              if (
                typeof digest?.id !== 'string' ||
                typeof digest?.name !== 'string' ||
                !Array.isArray(digest?.topics) ||
                typeof digest?.radius !== 'number'
              ) {
                return null;
              }

              if (
                typeof digest?.position?.x === 'number' &&
                typeof digest?.position?.y === 'number'
              ) {
                return {
                  id: digest.id,
                  name: digest.name,
                  topics: digest.topics
                    .filter((value: unknown) => typeof value === 'string')
                    .map((value: string) => normalizeTopicId(value)),
                  position: digest.position,
                  radius: digest.radius,
                  createdAt: typeof digest?.createdAt === 'number' ? digest.createdAt : Date.now(),
                } satisfies DigestPreset;
              }

              if (
                typeof digest?.pinX === 'number' &&
                typeof digest?.pinY === 'number'
              ) {
                return {
                  id: digest.id,
                  name: digest.name,
                  topics: digest.topics
                    .filter((value: unknown) => typeof value === 'string')
                    .map((value: string) => normalizeTopicId(value)),
                  position: canvasToGraphPoint(digest.pinX, digest.pinY, graphWidth, graphHeight),
                  radius: digest.radius,
                  createdAt: typeof digest?.createdAt === 'number' ? digest.createdAt : Date.now(),
                } satisfies DigestPreset;
              }

              return null;
            })
            .filter(Boolean) as DigestPreset[];

          setDigests(normalizedDigests);
        } else {
          setDigests([]);
        }
      } else {
        setDigests([]);
      }
    } catch {}
  }, [graphHeight, graphWidth, user?.id]);

  const persistDigests = (nextDigests: DigestPreset[]) => {
    setDigests(nextDigests);
    if (user?.id && typeof window !== 'undefined') {
      window.localStorage.setItem(
        getDigestStorageKey(user.id),
        JSON.stringify(nextDigests),
      );
    }
  };

  const loadTopics = useCallback(async () => {
    let cancelled = false;

    const applyTopics = async () => {
      if (!cancelled) {
        setIsTopicsLoading(true);
      }

      const cachedTopics = readCachedTopics();
      const cachedTrendingTopics = readCachedTrendingTopics();

      if (!cancelled) {
        if (cachedTopics?.seedTopics?.length) {
          setSeedTopics(cachedTopics.seedTopics.map((topic) => topic.name).filter(Boolean));
        }
        if (cachedTopics?.allTopics?.length) {
          setAllTopics(cachedTopics.allTopics.map((topic) => topic.name).filter(Boolean));
        }
        if (cachedTrendingTopics?.length) {
          setTrendingTopics(cachedTrendingTopics.map((topic) => topic.name).filter(Boolean));
        }
      }

      try {
        const [topicsResponse, trendingResponse] = await Promise.allSettled([
          fetchTopics(),
          fetchTrendingTopics(),
        ]);

        let nextSeedTopics: string[] = [];
        let nextAllTopics: string[] = [];
        let nextTrendingTopics: string[] = [];

        if (topicsResponse.status === 'fulfilled') {
          nextSeedTopics = topicsResponse.value.seedTopics
            .map((topic) => topic.name)
            .filter(Boolean);
          nextAllTopics = topicsResponse.value.allTopics
            .map((topic) => topic.name)
            .filter(Boolean);
        }

        if (trendingResponse.status === 'fulfilled') {
          nextTrendingTopics = trendingResponse.value
            .map((topic) => topic.name)
            .filter(Boolean);
        }

        if (!cancelled) {
          setSeedTopics(
            nextSeedTopics.length
              ? nextSeedTopics
              : cachedTopics?.seedTopics?.length
                ? cachedTopics.seedTopics.map((topic) => topic.name).filter(Boolean)
                : FALLBACK_TOPICS,
          );
          setAllTopics(
            nextAllTopics.length
              ? nextAllTopics
              : cachedTopics?.allTopics?.length
                ? cachedTopics.allTopics.map((topic) => topic.name).filter(Boolean)
                : FALLBACK_TOPICS,
          );
          setTrendingTopics(
            nextTrendingTopics.length
              ? nextTrendingTopics
              : cachedTrendingTopics?.length
                ? cachedTrendingTopics.map((topic) => topic.name).filter(Boolean)
                : FALLBACK_TRENDING_TOPICS,
          );
          setIsTopicsLoading(false);
        }
      } catch {
        if (!cancelled) {
          setSeedTopics(
            cachedTopics?.seedTopics?.length
              ? cachedTopics.seedTopics.map((topic) => topic.name).filter(Boolean)
              : FALLBACK_TOPICS,
          );
          setAllTopics(
            cachedTopics?.allTopics?.length
              ? cachedTopics.allTopics.map((topic) => topic.name).filter(Boolean)
              : FALLBACK_TOPICS,
          );
          setTrendingTopics(
            cachedTrendingTopics?.length
              ? cachedTrendingTopics.map((topic) => topic.name).filter(Boolean)
              : FALLBACK_TRENDING_TOPICS,
          );
          setIsTopicsLoading(false);
        }
      }

      return () => {
        cancelled = true;
      };
    };

    return applyTopics();
  }, []);

  useEffect(() => {
    let release: (() => void) | void;

    void loadTopics().then((cleanup) => {
      release = cleanup;
    });

    return () => {
      if (typeof release === 'function') {
        release();
      }
    };
  }, [loadTopics]);

  useFocusEffect(
    useCallback(() => {
      let release: (() => void) | void;

      void loadTopics().then((cleanup) => {
        release = cleanup;
      });

      return () => {
        if (typeof release === 'function') {
          release();
        }
      };
    }, [loadTopics]),
  );

  const query = search.toLowerCase().trim();
  const visibleTopics = useMemo(() => {
    const pool = query ? allTopics.filter(topic => topic.toLowerCase().includes(query)) : seedTopics;
    return pool.filter(topic => !selectedTopics.includes(normalizeTopicId(topic)));
  }, [allTopics, query, seedTopics, selectedTopics]);

  const isExactTopicMatch = useMemo(
    () => allTopics.some(topic => topic.toLowerCase() === query),
    [allTopics, query],
  );
  const exactMatchingTopicLabel = useMemo(
    () => allTopics.find((topic) => normalizeTopicId(topic) === normalizeTopicId(search.trim())) || null,
    [allTopics, search],
  );
  const isAlreadySelectedTopic = useMemo(
    () => Boolean(exactMatchingTopicLabel && selectedTopics.includes(normalizeTopicId(exactMatchingTopicLabel))),
    [exactMatchingTopicLabel, selectedTopics],
  );

  const showAddAsPrompt = query.length > 0 && !isExactTopicMatch && !promptTerms.includes(search.trim());

  const hasSearchCriteria = selectedTopics.length > 0 || promptTerms.length > 0;
  const radiusPercent = Math.round(radius * 100);
  const hasChanges =
    JSON.stringify(selectedTopics) !== JSON.stringify(initialState.topics) ||
    JSON.stringify(promptTerms) !== JSON.stringify(initialState.promptTerms) ||
    currentGraphPosition.x !== initialState.position.x ||
    currentGraphPosition.y !== initialState.position.y ||
    radiusPercent !== initialState.radius;
  const topNewsFilterState =
    hasSearchCriteria
      ? null
      : hasAppliedTopNewsFilter ||
          !isDefaultGraphSelection(currentGraphPosition, radiusPercent)
        ? 'active'
        : null;
  const showSelectedFilters = Boolean(topNewsFilterState || hasSearchCriteria);
  const availableTrendingTopics = useMemo(
    () => trendingTopics.filter((topic) => !selectedTopics.includes(normalizeTopicId(topic))),
    [selectedTopics, trendingTopics],
  );
  const selectedTrendingTopicIds = useMemo(
    () => new Set(trendingTopics.map((topic) => normalizeTopicId(topic))),
    [trendingTopics],
  );
  const showInlineTopicLoading = isTopicsLoading && !isDropdownOpen && !showSelectedFilters && !query;

  const cancelScheduledDropdownClose = useCallback(() => {
    if (dropdownCloseTimeoutRef.current) {
      clearTimeout(dropdownCloseTimeoutRef.current);
      dropdownCloseTimeoutRef.current = null;
    }
  }, []);

  const closeDropdown = useCallback(() => {
    cancelScheduledDropdownClose();
    setIsDropdownOpen(false);
  }, [cancelScheduledDropdownClose]);

  const scheduleDropdownClose = useCallback(() => {
    cancelScheduledDropdownClose();
    dropdownCloseTimeoutRef.current = setTimeout(() => {
      setIsDropdownOpen(false);
      dropdownCloseTimeoutRef.current = null;
    }, 180);
  }, [cancelScheduledDropdownClose]);

  const openDropdown = useCallback(() => {
    cancelScheduledDropdownClose();
    setIsDropdownOpen(true);
  }, [cancelScheduledDropdownClose]);

  useEffect(() => () => cancelScheduledDropdownClose(), [cancelScheduledDropdownClose]);

  useEffect(() => {
    graphPositionRef.current = canvasToGraphPoint(pinX, pinY, graphWidth, graphHeight);
  }, [pinX, pinY]);

  useEffect(() => {
    const previousSize = previousGraphSizeRef.current;
    if (
      previousSize.width === graphWidth &&
      previousSize.height === graphHeight
    ) {
      return;
    }

    previousGraphSizeRef.current = {
      width: graphWidth,
      height: graphHeight,
    };

    const nextPin = graphPointToCanvas(
      graphPositionRef.current,
      graphWidth,
      graphHeight,
    );

    setPinX(nextPin.x);
    setPinY(nextPin.y);
  }, [graphHeight, graphWidth]);

  const updatePinFromTouch = (locationX: number, locationY: number) => {
    setPinX(clamp(locationX, 0, graphWidth));
    setPinY(clamp(locationY, 0, graphHeight));
  };

  const updateRadiusFromTouch = (locationX: number) => {
    const nextRatio = clamp(locationX / sliderTrackWidth, 0.05, 1);
    const stepped = Math.round((nextRatio * 100) / 5) * 5;
    setRadius(clamp(stepped / 100, 0.05, 1));
  };

  const graphPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          graphDragActive.current = true;
          const { locationX, locationY } = event.nativeEvent;
          updatePinFromTouch(locationX, locationY);
        },
        onPanResponderMove: (event) => {
          const { locationX, locationY } = event.nativeEvent;
          updatePinFromTouch(locationX, locationY);
        },
        onPanResponderRelease: () => {
          graphDragActive.current = false;
        },
        onPanResponderTerminate: () => {
          graphDragActive.current = false;
        },
      }),
    [graphHeight, graphWidth],
  );

  const sliderPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderGrant: (event) => {
          updateRadiusFromTouch(event.nativeEvent.locationX);
        },
        onPanResponderMove: (event) => {
          updateRadiusFromTouch(event.nativeEvent.locationX);
        },
      }),
    [sliderTrackWidth],
  );

  const handleTopicSelect = (topic: string) => {
    const normalizedTopic = normalizeTopicId(topic);
    if (!selectedTopics.includes(normalizedTopic)) {
      setSelectedTopics((prev) => [...prev, normalizedTopic]);
    }
    setSearch('');
    searchInputRef.current?.blur();
    closeDropdown();
  };

  const handlePromptAdd = () => {
    const trimmed = search.trim();
    if (!trimmed || promptTerms.includes(trimmed)) return;
    setPromptTerms((prev) => [...prev, trimmed]);
    setSearch('');
    searchInputRef.current?.blur();
    closeDropdown();
  };

  const handleSearchSubmit = () => {
    const trimmed = search.trim();
    if (!trimmed) return;
    const matchedTopic = allTopics.find((topic) => normalizeTopicId(topic) === normalizeTopicId(trimmed));
    if (matchedTopic) {
      handleTopicSelect(matchedTopic);
      return;
    }
    handlePromptAdd();
  };

  const removeTopic = (topic: string) => {
    setSelectedTopics((prev) => prev.filter((item) => item !== topic));
  };

  const removePrompt = (term: string) => {
    setPromptTerms((prev) => prev.filter((item) => item !== term));
  };

  const handleApplyChanges = () => {
    if (isApplying) return;
    setIsApplying(true);

    try {
      const nextRecommendationRequest: RecommendationRequestState = {
        prompt: promptTerms.join('; '),
        topics: selectedTopics,
        position: {
          x: currentGraphPosition.x / 100,
          y: currentGraphPosition.y / 100,
        },
        radius: radiusPercent / 100,
      };
      const nextTopNewsGraphFilter =
        hasSearchCriteria || isDefaultGraphSelection(currentGraphPosition, radiusPercent)
          ? null
          : {
              position: { ...currentGraphPosition },
              radius: radiusPercent,
            };

      setInitialState({
        topics: [...selectedTopics],
        promptTerms: [...promptTerms],
        position: { ...currentGraphPosition },
        radius: radiusPercent,
      });

      if (hasSearchCriteria) {
        setHasAppliedTopNewsFilter(false);
        closeDropdown();
        const prefetchedArticles = getRecommenderConfig().isEnabled
          ? null
          : buildSafeModePrefetchedArticles({
              topics: selectedTopics,
              promptTerms,
              position: currentGraphPosition,
              radius: radiusPercent,
            });
        applyQueryPreferences({
          activeQuery: {
            topics: selectedTopics,
            promptTerms,
          },
          recommendationRequest: nextRecommendationRequest,
          prefetchedArticles,
        });

        router.navigate('/(tabs)');
        return;
      }

      setHasAppliedTopNewsFilter(Boolean(nextTopNewsGraphFilter));
      closeDropdown();
      applyTopNewsPreferences(nextTopNewsGraphFilter);

      router.navigate('/(tabs)');
    } catch (error) {
      console.warn('[GraphScreen] Failed to apply changes', error);
      setIsApplying(false);
      Alert.alert(
        'Could not apply changes',
        'Please try again.',
      );
    }
  };

  const handleTopNewsReset = () => {
    setPinX(centerX);
    setPinY(centerY);
    setRadius(DEFAULT_GRAPH_RADIUS / 100);
    setHasAppliedTopNewsFilter(false);
    writeTopNewsGraphFilter(null);
  };

  const handleOpenSaveDialog = () => {
    if (!hasSearchCriteria) return;
    if (!user) {
      setShowSignInDialog(true);
      return;
    }
    setDigestName('');
    setShowSaveDialog(true);
  };

  const handleSavePreset = () => {
    if (!user || !digestName.trim()) return;

    const nextPreset: DigestPreset = {
      id: String(Date.now()),
      name: digestName.trim(),
      topics: [...selectedTopics],
      position: { ...currentGraphPosition },
      radius: radiusPercent,
      createdAt: Date.now(),
    };

    persistDigests([...digests, nextPreset]);
    setDigestName('');
    setShowSaveDialog(false);
  };

  const handleLoadPreset = (preset: DigestPreset) => {
    const point = graphPointToCanvas(preset.position, graphWidth, graphHeight);
    setSelectedTopics(preset.topics.map(normalizeTopicId));
    setPromptTerms([]);
    setPinX(point.x);
    setPinY(point.y);
    setRadius(preset.radius / 100);
    searchInputRef.current?.blur();
    closeDropdown();
  };

  const handleDeletePreset = (presetId: string, presetName: string) => {
    const removePreset = () => {
      persistDigests(digests.filter((preset) => preset.id !== presetId));
    };

    if (typeof window !== 'undefined' && typeof window.confirm === 'function') {
      if (!window.confirm(`Delete the preset "${presetName}"?`)) return;
      removePreset();
      return;
    }

    Alert.alert(
      'Delete preset',
      `Delete the preset "${presetName}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Delete', style: 'destructive', onPress: removePreset },
      ],
    );
  };

  const positionedOutlets = useMemo(
    () =>
      OUTLETS.map((outlet) => ({
        ...outlet,
        x: graphToSvg(outlet.gx, graphWidth) + (outlet.dx ?? 0),
        y: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy,
        imageX: graphToSvg(outlet.gx, graphWidth) + (outlet.dx ?? 0) - outlet.width / 2,
        imageY: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy - outlet.height / 2,
        labelY: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy + outlet.height / 2 + (outlet.labelDy ?? 10),
      })),
    [graphHeight, graphWidth],
  );

  return (
    <SafeAreaView style={[s.container, { backgroundColor: PAGE.background }]}>
      {isHelpOpen || showSaveDialog || showSignInDialog ? (
        <Pressable
          style={s.modalBackdrop}
          onPress={() => {
            setIsHelpOpen(false);
            setShowSaveDialog(false);
            setShowSignInDialog(false);
          }}
        />
      ) : null}

      <Pressable onPress={isDropdownOpen ? closeDropdown : undefined}>
      <View style={[s.header, { borderBottomColor: PAGE.border }]}>
        <View style={s.headerLeft}>
          <TouchableOpacity
            style={s.headerIcon}
            onPress={() => router.push('/modal/profile')}
            accessibilityRole="button"
            accessibilityLabel="Open profile"
          >
            <Ionicons name="person-outline" size={20} color={PAGE.text} />
          </TouchableOpacity>
          <View style={[s.streakPill, { backgroundColor: '#E9EDD8', borderColor: '#D9DEC5' }]}>
            <Ionicons name="flame-outline" size={15} color="#8DAE73" />
            <Text style={s.streakText}>{profile?.reading_streak ?? 3}</Text>
          </View>
        </View>
        <Text style={s.headerTitle}>Praxis</Text>
        <View style={s.headerRight}>
          <TouchableOpacity
            style={s.headerIcon}
            onPress={() => router.push('/modal/saved-articles')}
            accessibilityRole="button"
            accessibilityLabel="Open saved articles"
          >
            <Ionicons name="bookmark-outline" size={20} color={PAGE.text} />
          </TouchableOpacity>
          <TouchableOpacity
            style={s.headerIcon}
            onPress={() => router.push('/modal/search')}
            accessibilityRole="button"
            accessibilityLabel="Open search"
          >
            <Ionicons name="search-outline" size={20} color={PAGE.text} />
          </TouchableOpacity>
        </View>
      </View>
      </Pressable>

      <View style={s.controls}>
        <View style={s.searchRow}>
          <View style={[s.searchShell, { borderColor: PAGE.chipBorder }]}>
            <Ionicons name="search-outline" size={22} color={PAGE.textMuted} />
            <TextInput
              ref={searchInputRef}
              value={search}
              onChangeText={(value) => {
                setSearch(value);
                if (!isDropdownOpen) openDropdown();
              }}
              onFocus={openDropdown}
              onBlur={scheduleDropdownClose}
              onSubmitEditing={handleSearchSubmit}
              placeholder="Search topics or add keywords..."
              placeholderTextColor={PAGE.textMuted}
              style={s.searchInput}
              returnKeyType="search"
              testID="graph-search-input"
              accessibilityLabel="Search topics or add keywords"
            />
            {(search.length > 0 || isDropdownOpen) ? (
              <TouchableOpacity
                onPress={() => {
                  cancelScheduledDropdownClose();
                  if (search.length > 0) {
                    setSearch('');
                    openDropdown();
                    searchInputRef.current?.focus();
                    return;
                  }

                  searchInputRef.current?.blur();
                  closeDropdown();
                }}
                style={s.clearButton}
              >
                <Ionicons name="close" size={14} color={PAGE.textMuted} />
              </TouchableOpacity>
            ) : null}
          </View>
          <TouchableOpacity
            style={[
              s.saveButton,
              {
                borderColor: PAGE.chipBorder,
                backgroundColor: hasSearchCriteria ? '#EAF2E1' : '#F3EEE3',
              },
            ]}
            onPress={handleOpenSaveDialog}
            disabled={!hasSearchCriteria}
            accessibilityRole="button"
            accessibilityLabel="Save graph preset"
            testID="graph-save-button"
          >
            <Ionicons name="add" size={22} color={hasSearchCriteria ? PAGE.green : PAGE.textSoft} />
            <Text style={[s.saveButtonText, { color: hasSearchCriteria ? '#5D7650' : PAGE.textSoft }]}>Save</Text>
          </TouchableOpacity>
        </View>

        {showInlineTopicLoading ? (
          <View style={s.inlineLoadingRow}>
            <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipShort]} />
            <View style={s.dropdownLoadingChip} />
            <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipMedium]} />
          </View>
        ) : null}

        {isDropdownOpen ? (
          <View style={s.dropdownOverlay} onTouchStart={cancelScheduledDropdownClose}>
            <View style={s.dropdown}>
            {digests.length > 0 || hasSearchCriteria ? (
              <View style={s.presetsBlock}>
                <Text style={s.dropdownLabel}>Saved presets</Text>
                {digests.length > 0 ? (
                  <View style={s.presetsRow}>
                    {digests.map((preset) => (
                      <View key={preset.id} style={s.presetWrap}>
                        <TouchableOpacity
                          style={s.presetChip}
                          onPress={() => handleLoadPreset(preset)}
                          accessibilityRole="button"
                          accessibilityLabel={`Load preset ${preset.name}`}
                          testID={`graph-preset-${topicToTestId(preset.name)}`}
                        >
                          <Text style={s.presetChipText}>{preset.name}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                          style={s.presetDelete}
                          onPress={() => handleDeletePreset(preset.id, preset.name)}
                        >
                          <Ionicons name="close" size={10} color={PAGE.textMuted} />
                        </TouchableOpacity>
                      </View>
                    ))}
                  </View>
                ) : (
                  <Text style={s.emptyDropdownText}>No saved presets yet.</Text>
                )}
              </View>
            ) : null}
            {showAddAsPrompt ? (
              <TouchableOpacity onPress={handlePromptAdd} style={s.dropdownSearchRow}>
                <View style={s.dropdownSearchLeft}>
                  <Ionicons name="chatbubble-ellipses-outline" size={16} color={PAGE.textMuted} />
                  <Text style={s.dropdownSearchText}>Search for "{search.trim()}"</Text>
                </View>
                <Ionicons name="add" size={16} color={PAGE.textMuted} />
              </TouchableOpacity>
            ) : null}

            <Text style={s.dropdownLabel}>{query ? 'Matching topics' : 'Categories'}</Text>
            <ScrollView
              style={s.dropdownScroll}
              contentContainerStyle={s.dropdownTopics}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled
            >
              {isTopicsLoading && visibleTopics.length === 0 && !query ? (
                <View style={s.dropdownLoadingWrap}>
                  <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipWide]} />
                  <View style={s.dropdownLoadingChip} />
                  <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipShort]} />
                  <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipMedium]} />
                  <View style={s.dropdownLoadingChip} />
                  <View style={[s.dropdownLoadingChip, s.dropdownLoadingChipWide]} />
                </View>
              ) : visibleTopics.length > 0 ? (
                visibleTopics.map((topic) => (
                  <TouchableOpacity
                    key={topic}
                    style={s.dropdownTopicChip}
                    onPressIn={() => handleTopicSelect(topic)}
                    accessibilityRole="button"
                    accessibilityLabel={`Select topic ${topic}`}
                    testID={`graph-topic-${topicToTestId(topic)}`}
                  >
                    <Text style={s.dropdownTopicText}>{topic}</Text>
                  </TouchableOpacity>
                ))
              ) : (
                <Text style={s.emptyDropdownText}>
                  {query
                    ? isAlreadySelectedTopic
                      ? 'Topic already selected'
                      : 'No matching topics'
                    : 'All topics selected'}
                </Text>
              )}
            </ScrollView>
            </View>
          </View>
        ) : null}

        {showSelectedFilters ? (
          <View style={s.selectedFiltersSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.selectedFiltersRow}
            >
              {topNewsFilterState ? (
                <TouchableOpacity
                  onPress={handleTopNewsReset}
                  style={s.topNewsPill}
                  accessibilityRole="button"
                  accessibilityLabel="Reset top news filter"
                  testID="graph-top-news-reset"
                >
                  <Ionicons name="flame-outline" size={14} color="#D57A24" />
                  <Text style={s.topNewsPillText}>Top News</Text>
                </TouchableOpacity>
              ) : null}

              {selectedTopics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  onPressIn={() => removeTopic(topic)}
                  activeOpacity={0.82}
                  style={[
                    s.selectedTopicPill,
                    selectedTrendingTopicIds.has(topic) ? s.selectedTrendingTopicPill : null,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove topic ${topicIdToLabel(topic, allTopics)}`}
                >
                  {selectedTrendingTopicIds.has(topic) ? (
                    <Ionicons name="trending-up-outline" size={12} color="#A56F2A" />
                  ) : null}
                  <Text
                    style={[
                      s.selectedTopicText,
                      selectedTrendingTopicIds.has(topic) ? s.selectedTrendingTopicText : null,
                    ]}
                  >
                    {topicIdToLabel(topic, allTopics)}
                  </Text>
                  <Ionicons
                    name="close"
                    size={12}
                    color={selectedTrendingTopicIds.has(topic) ? '#A56F2A' : PAGE.textMuted}
                  />
                </TouchableOpacity>
              ))}
              {promptTerms.map((term) => (
                <TouchableOpacity
                  key={term}
                  onPressIn={() => removePrompt(term)}
                  activeOpacity={0.82}
                  style={s.promptPill}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove keyword ${term}`}
                >
                  <Ionicons name="chatbubble-ellipses-outline" size={12} color={PAGE.textMuted} />
                  <Text style={s.promptPillText}>{term}</Text>
                  <Ionicons name="close" size={12} color={PAGE.textMuted} />
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}

        {availableTrendingTopics.length > 0 ? (
          <View style={s.filterArea}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.topicRow}
            >
              <View style={s.topicRowLead}>
                <Ionicons name="trending-up-outline" size={14} color={PAGE.textSoft} />
              </View>
              {availableTrendingTopics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  style={s.topicChip}
                  onPressIn={() => handleTopicSelect(topic)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select trending topic ${topic}`}
                  testID={`graph-trending-${topicToTestId(topic)}`}
                >
                  <Text style={s.topicChipText}>{topic}</Text>
                  <Text style={s.topicChipPlus}>+</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        ) : null}
      </View>

      <Pressable style={s.graphSection} onPress={isDropdownOpen ? closeDropdown : undefined}>
        <View
          style={s.graphWrap}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setGraphViewport((previous) => {
              const nextWidth = Math.round(width);
              const nextHeight = Math.round(height);
              if (
                previous.width === nextWidth &&
                previous.height === nextHeight
              ) {
                return previous;
              }

              return {
                width: nextWidth,
                height: nextHeight,
              };
            });
          }}
        >
          <View
            style={[s.graphCanvas, { width: graphWidth, height: graphHeight }]}
            {...graphPanResponder.panHandlers}
          >
            <TouchableOpacity
              style={[s.helpButton, { borderColor: PAGE.chipBorder }]}
              activeOpacity={0.85}
              onPress={() => setIsHelpOpen(true)}
            >
              <Ionicons name="help-circle-outline" size={26} color={PAGE.text} />
            </TouchableOpacity>
            <Svg width={graphWidth} height={graphHeight}>
            <Line x1={centerX} y1={34} x2={centerX} y2={graphHeight - 34} stroke="#D3CCC1" strokeWidth={2} />
            <Line x1={34} y1={centerY} x2={graphWidth - 34} y2={centerY} stroke="#D3CCC1" strokeWidth={2} />

            <Circle
              cx={pinX}
              cy={pinY}
              r={radiusPx}
              fill="rgba(141,174,115,0.08)"
              stroke={PAGE.green}
              strokeWidth={3}
              strokeDasharray="6,5"
            />
            <Circle cx={pinX} cy={pinY} r={16} fill={PAGE.green} stroke="#FFFFFF" strokeWidth={5} />
            {positionedOutlets.map((outlet) => (
              <React.Fragment key={outlet.key}>
                <SvgImage
                  x={outlet.imageX}
                  y={outlet.imageY}
                  width={outlet.width}
                  height={outlet.height}
                  href={outlet.logoWeb}
                  preserveAspectRatio="xMidYMid meet"
                  opacity={0.98}
                />
                <SvgText
                  x={outlet.x}
                  y={outlet.labelY}
                  textAnchor="middle"
                  fill={PAGE.textMuted}
                  opacity={0.78}
                  fontSize="8.5"
                  fontWeight="500"
                >
                  {outlet.label}
                </SvgText>
              </React.Fragment>
            ))}
            </Svg>
            <View style={[s.axisPill, s.axisTopPill]}>
              <Text style={s.axisPillText}>Hard</Text>
            </View>
            <View style={[s.axisPill, s.axisBottomPill]}>
              <Text style={s.axisPillText}>Opinion</Text>
            </View>
            <View style={[s.axisPill, s.axisLeftPill]}>
              <Text style={s.axisPillText}>Left</Text>
            </View>
            <View style={[s.axisPill, s.axisRightPill]}>
              <Text style={s.axisPillText}>Right</Text>
            </View>
          </View>
        </View>
      </Pressable>

      {hasChanges || isApplying ? (
        <View style={s.applyBar}>
          <TouchableOpacity
            style={[
              s.applyButton,
              (!hasChanges || isApplying) && s.applyButtonDisabled,
            ]}
            onPress={handleApplyChanges}
            disabled={!hasChanges || isApplying}
            accessibilityRole="button"
            accessibilityLabel="Apply graph changes"
            testID="graph-apply-button"
          >
            <Text style={s.applyButtonText}>
              {isApplying ? 'Loading...' : 'Apply Changes →'}
            </Text>
          </TouchableOpacity>
        </View>
      ) : null}

      {isHelpOpen ? (
        <View style={s.modalWrap} pointerEvents="box-none">
          <View style={s.helpModal}>
            <View style={s.helpHeader}>
              <View style={s.helpTitleBlock}>
                <Text style={s.helpTitle}>About the News Map</Text>
                <Text style={s.helpSubtitle}>Understanding the news positioning graph</Text>
              </View>
              <TouchableOpacity style={s.helpCloseButton} onPress={() => setIsHelpOpen(false)}>
                <Ionicons name="close" size={18} color="#8DAE73" />
              </TouchableOpacity>
            </View>

            <View style={s.helpSection}>
              <Text style={s.helpSectionTitle}>Political Leaning (← Left ↔ Right →)</Text>
              <Text style={s.helpBody}>
                The horizontal axis represents the political perspective of news sources. Left side shows progressive viewpoints, right side shows conservative viewpoints.
              </Text>
            </View>

            <View style={s.helpSection}>
              <Text style={s.helpSectionTitle}>Reporting Style (↑ Hard News ↔ Opinion ↓)</Text>
              <Text style={s.helpBody}>
                The vertical axis represents how factual vs. opinionated the coverage is. Higher is straight reporting and analysis. Lower is opinion pieces and commentary.
              </Text>
            </View>

            <View style={s.helpSection}>
              <Text style={s.helpSectionTitle}>How to Use</Text>
              <Text style={s.helpBody}>
                Tap on the map to select your preferred position, then adjust the radius to control how similar sources should be. A larger radius includes more diverse sources.
              </Text>
            </View>
          </View>
        </View>
      ) : null}

      {showSaveDialog ? (
        <View style={s.modalWrap} pointerEvents="box-none">
          <View style={s.dialogCard}>
            <Text style={s.dialogTitle}>Save Preset</Text>
            <Text style={s.dialogDescription}>
              Give your personalized news configuration a name to save it as a preset.
            </Text>
            <TextInput
              value={digestName}
              onChangeText={setDigestName}
              placeholder="Preset name..."
              placeholderTextColor={PAGE.textMuted}
              style={s.dialogInput}
              autoFocus
            />
            <View style={s.dialogActions}>
              <TouchableOpacity
                style={s.dialogSecondaryButton}
                onPress={() => setShowSaveDialog(false)}
              >
                <Text style={s.dialogSecondaryText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[
                  s.dialogPrimaryButton,
                  !digestName.trim() && s.dialogPrimaryButtonDisabled,
                ]}
                disabled={!digestName.trim()}
                onPress={handleSavePreset}
              >
                <Text style={s.dialogPrimaryText}>Save Preset</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      {showSignInDialog ? (
        <View style={s.modalWrap} pointerEvents="box-none">
          <View style={s.dialogCard}>
            <Text style={s.dialogTitle}>Sign in to save presets</Text>
            <Text style={s.dialogDescription}>
              You can keep adjusting this filter, but you need an account to save presets for later.
            </Text>
            <View style={s.dialogActions}>
              <TouchableOpacity
                style={s.dialogSecondaryButton}
                onPress={() => setShowSignInDialog(false)}
              >
                <Text style={s.dialogSecondaryText}>Not now</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={s.dialogPrimaryButton}
                onPress={() => {
                  setShowSignInDialog(false);
                  router.push('/(auth)/login');
                }}
              >
                <Text style={s.dialogPrimaryText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

      <Pressable style={[s.sliderSection, { borderTopColor: PAGE.border }]} onPress={isDropdownOpen ? closeDropdown : undefined}>
        <Text style={s.sliderLabel}>Radius</Text>
        <View style={s.sliderTrackWrap}>
          <View
            style={[s.sliderTrack, { backgroundColor: PAGE.sliderTrack, width: sliderTrackWidth }]}
            {...sliderPanResponder.panHandlers}
          >
            <View style={[s.sliderFill, { width: `${radius * 100}%`, backgroundColor: PAGE.green }]} />
            <View style={[s.sliderThumb, { left: `${radius * 100}%`, borderColor: PAGE.green }]} />
          </View>
        </View>
        <View style={[s.percentPill, { borderColor: PAGE.chipBorder }]}>
          <Text style={s.percentText}>{Math.round(radius * 100)}%</Text>
        </View>
      </Pressable>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  container: { flex: 1 },
  modalBackdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 32, 29, 0.26)',
    zIndex: 70,
  },
  header: {
    height: 88,
    borderBottomWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 18,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: PAGE.text,
    letterSpacing: -0.5,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 92,
  },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  streakPill: {
    height: 34,
    borderRadius: 17,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  streakText: {
    color: '#5F6A4F',
    fontSize: 14,
    fontWeight: '700',
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 92,
    justifyContent: 'flex-end',
  },
  controls: {
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 2,
    gap: 8,
    zIndex: 20,
  },
  searchRow: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
    zIndex: 25,
  },
  searchShell: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(255,253,247,0.92)',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: PAGE.text,
  },
  clearButton: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEE7DA',
  },
  saveButton: {
    height: 48,
    minWidth: 110,
    borderRadius: 24,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 14,
  },
  saveButtonText: {
    color: PAGE.textSoft,
    fontSize: 14,
    fontWeight: '500',
  },
  inlineLoadingRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingHorizontal: 4,
    paddingTop: 2,
  },
  dropdownOverlay: {
    position: 'absolute',
    left: 18,
    right: 18,
    top: 60,
    zIndex: 40,
  },
  dropdown: {
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E7DECF',
    backgroundColor: '#FAF7F0',
    padding: 11,
    gap: 9,
    shadowColor: '#A39B8E',
    shadowOpacity: 0.08,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 3,
  },
  presetsBlock: {
    gap: 8,
  },
  presetsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  presetWrap: {
    position: 'relative',
    maxWidth: '100%',
    paddingTop: 4,
    paddingRight: 4,
  },
  presetChip: {
    maxWidth: 156,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#BCD2A8',
    backgroundColor: '#DCE9CA',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  presetChipText: {
    fontSize: 12.5,
    color: '#47513F',
    fontWeight: '600',
  },
  presetDelete: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: '#FBF7EF',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownSearchRow: {
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E4DDD1',
    backgroundColor: '#F4EFE4',
    paddingHorizontal: 12,
    paddingVertical: 11,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  dropdownSearchLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
    paddingRight: 10,
  },
  dropdownSearchText: {
    fontSize: 14,
    color: PAGE.text,
  },
  dropdownLabel: {
    fontSize: 12,
    color: PAGE.textMuted,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  dropdownScroll: {
    maxHeight: 210,
  },
  dropdownTopics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingBottom: 4,
  },
  dropdownLoadingWrap: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    width: '100%',
    paddingBottom: 4,
  },
  dropdownLoadingChip: {
    height: 31,
    width: 82,
    borderRadius: 11,
    backgroundColor: '#EEE7DA',
    borderWidth: 1,
    borderColor: '#E6DECF',
  },
  dropdownLoadingChipShort: {
    width: 64,
  },
  dropdownLoadingChipMedium: {
    width: 96,
  },
  dropdownLoadingChipWide: {
    width: 118,
  },
  dropdownTopicChip: {
    borderRadius: 11,
    borderWidth: 1,
    borderColor: '#E3DACB',
    backgroundColor: '#F7F3EB',
    paddingHorizontal: 10,
    paddingVertical: 7,
  },
  dropdownTopicText: {
    fontSize: 12.5,
    color: '#4C4740',
    fontWeight: '500',
  },
  emptyDropdownText: {
    fontSize: 13,
    color: PAGE.textMuted,
    paddingVertical: 8,
  },
  filterArea: {
    minHeight: 30,
    justifyContent: 'center',
    zIndex: 10,
  },
  selectedFiltersSection: {
    minHeight: 36,
    justifyContent: 'center',
    zIndex: 10,
  },
  selectedFiltersRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingRight: 24,
  },
  selectedTopicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#DDD4C5',
    backgroundColor: '#F7F3EB',
  },
  selectedTrendingTopicPill: {
    borderColor: '#E9BF78',
    backgroundColor: '#F8E4B8',
  },
  selectedTopicText: {
    fontSize: 12,
    color: '#4C4740',
    fontWeight: '500',
  },
  selectedTrendingTopicText: {
    color: '#A56F2A',
    fontWeight: '600',
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9D1C3',
    backgroundColor: '#F4EFE6',
  },
  promptPillText: {
    fontSize: 12,
    color: '#706A62',
    fontWeight: '500',
  },
  topNewsPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#F1C58A',
    backgroundColor: '#FAE9D2',
  },
  topNewsPillText: {
    fontSize: 12,
    color: '#D57A24',
    fontWeight: '600',
  },
  topicRow: {
    flexDirection: 'row',
    gap: 12,
    alignItems: 'center',
    paddingRight: 24,
    minHeight: 30,
  },
  topicRowLead: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingRight: 2,
  },
  topicChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 1,
  },
  topicChipText: {
    fontSize: 13.5,
    color: '#6E6962',
    fontWeight: '500',
  },
  topicChipPlus: {
    fontSize: 16,
    color: '#B4AEA6',
    fontWeight: '500',
  },
  graphSection: {
    flex: 1,
    minHeight: 0,
    flexShrink: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 18,
    paddingTop: 8,
    paddingBottom: 4,
    position: 'relative',
    zIndex: 1,
  },
  modalWrap: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 80,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
  },
  helpModal: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    paddingHorizontal: 22,
    paddingVertical: 20,
    shadowColor: '#312C26',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  dialogCard: {
    width: '100%',
    borderRadius: 18,
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    paddingHorizontal: 22,
    paddingVertical: 20,
    shadowColor: '#312C26',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
    gap: 14,
  },
  dialogTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#322E29',
  },
  dialogDescription: {
    fontSize: 13,
    lineHeight: 20,
    color: '#6A645C',
  },
  dialogInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#DDD4C5',
    backgroundColor: '#FFFDF7',
    paddingHorizontal: 14,
    color: '#322E29',
    fontSize: 15,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
  },
  dialogSecondaryButton: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    backgroundColor: '#FFFDF7',
  },
  dialogSecondaryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#5F5850',
  },
  dialogPrimaryButton: {
    height: 42,
    borderRadius: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#2F2A24',
  },
  dialogPrimaryButtonDisabled: {
    opacity: 0.45,
  },
  dialogPrimaryText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FBF7EF',
  },
  helpHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: 14,
    marginBottom: 14,
  },
  helpTitleBlock: {
    flex: 1,
    gap: 4,
  },
  helpTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#322E29',
  },
  helpSubtitle: {
    fontSize: 13,
    color: '#8B847C',
  },
  helpCloseButton: {
    width: 26,
    height: 26,
    borderRadius: 13,
    borderWidth: 1.5,
    borderColor: '#B8C99E',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FAF8F1',
  },
  helpSection: {
    gap: 6,
    marginBottom: 14,
  },
  helpSectionTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#322E29',
  },
  helpBody: {
    fontSize: 13,
    lineHeight: 21,
    color: '#5D5750',
  },
  helpButton: {
    position: 'absolute',
    right: 8,
    top: 6,
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,253,247,0.88)',
    zIndex: 3,
  },
  graphWrap: {
    flex: 1,
    width: '100%',
    minHeight: 0,
    flexShrink: 1,
    alignSelf: 'stretch',
    alignItems: 'center',
    justifyContent: 'center',
    maxWidth: 620,
    paddingHorizontal: 4,
    paddingTop: 14,
    paddingBottom: 14,
  },
  graphCanvas: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  axisPill: {
    position: 'absolute',
    borderRadius: 999,
    paddingHorizontal: 8,
    paddingVertical: 3,
    backgroundColor: 'rgba(255,253,247,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(221,212,197,0.8)',
  },
  axisPillText: {
    fontSize: 11,
    lineHeight: 13,
    fontWeight: '600',
    color: PAGE.textMuted,
  },
  axisTopPill: {
    top: 2,
    left: '50%',
    transform: [{ translateX: -20 }],
  },
  axisBottomPill: {
    bottom: 2,
    left: '50%',
    transform: [{ translateX: -26 }],
  },
  axisLeftPill: {
    left: 0,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  axisRightPill: {
    right: 0,
    top: '50%',
    transform: [{ translateY: -10 }],
  },
  sliderSection: {
    borderTopWidth: 1,
    paddingHorizontal: 18,
    paddingTop: 14,
    paddingBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  applyBar: {
    position: 'relative',
    zIndex: 12,
    elevation: 12,
    paddingHorizontal: 18,
    paddingBottom: 10,
    paddingTop: 2,
  },
  applyButton: {
    pointerEvents: 'auto',
    height: 44,
    borderRadius: 14,
    backgroundColor: '#2F2A24',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#2F2A24',
    shadowOpacity: 0.14,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  applyButtonDisabled: {
    opacity: 0.72,
  },
  applyButtonText: {
    fontSize: 14,
    color: '#FBF7EF',
    fontWeight: '700',
  },
  sliderLabel: {
    fontSize: 13,
    color: '#6F685F',
    width: 54,
    fontWeight: '600',
  },
  sliderTrackWrap: {
    flex: 1,
    justifyContent: 'center',
  },
  sliderTrack: {
    height: 8,
    borderRadius: 999,
    overflow: 'visible',
    justifyContent: 'center',
  },
  sliderFill: {
    height: 8,
    borderRadius: 999,
  },
  sliderThumb: {
    position: 'absolute',
    marginLeft: -15,
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: PAGE.background,
    borderWidth: 4,
    top: -11,
    shadowColor: '#8DAE73',
    shadowOpacity: 0.08,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 2,
  },
  percentPill: {
    minWidth: 72,
    height: 40,
    borderRadius: 20,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.58)',
  },
  percentText: {
    fontSize: 15,
    color: PAGE.text,
    fontWeight: '600',
  },
});
