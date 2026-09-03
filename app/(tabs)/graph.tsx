import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, SafeAreaView, TouchableOpacity, TextInput, ScrollView, Pressable, Alert, ActivityIndicator, Image as RNImage, Platform, Keyboard, InputAccessoryView, useWindowDimensions, ViewStyle, InteractionManager } from 'react-native';
import Svg, { Circle, Image as SvgImage, Line, Text as SvgText } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { Ionicons } from '@expo/vector-icons';
import { Link, router, useFocusEffect } from 'expo-router';
import { useIsFocused } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { useNewsPreferences } from '../context/NewsPreferencesContext';
import {
  ActiveQueryState,
  DEFAULT_GRAPH_POSITION,
  DEFAULT_GRAPH_RADIUS,
  DigestPreset,
  GraphPoint,
  isDefaultGraphSelection,
  readDigestPresets,
  readActiveQuery,
  readRecommendationRequest,
  readTopNewsGraphFilter,
  RecommendationRequestState,
  TopNewsGraphFilterState,
  writeDigestPresets,
} from '../lib/newsPreferences';
import {
  fetchTopics,
  fetchTrendingTopics,
  hydrateDiscoveryCache,
  readCachedTopics,
  readCachedTrendingTopics,
} from '../lib/discoveryData';
import {
  readReadingActivitySummary,
  subscribeReadingActivity,
} from '../lib/readingActivity';
import {
  getMockTopicArticles,
  SAFE_MODE_TOPIC_NAMES,
  SAFE_MODE_TRENDING_TOPIC_NAMES,
} from '../lib/mockPreviewData';
import { buildHref } from '../lib/buildHref';
import { getRecommenderConfig } from '../lib/recommenderConfig';
import { writeDailyDigestOpenRequest } from '../lib/dailyDigest';
import { searchGraphArticles } from '../hooks/useFeedArticles';

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
const SEARCH_INPUT_ACCESSORY_ID = 'graph-search-dismiss';
const MAX_TOPIC_SUGGESTIONS = 8;
const AnimatedCircle = Animated.createAnimatedComponent(Circle);

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
  { key: 'reuters', gx: 0, gy: 76, dx: -12, dy: -2, label: 'Reuters', labelDx: -25, labelAlign: 'end', logo: logoReuters, logoWeb: logoUri(logoReuters), width: 34, height: 12, labelDy: 10, blend: true },
  { key: 'ap', gx: 6, gy: 72, dx: 10, dy: -2, label: 'AP', labelDx: 24, labelAlign: 'start', logo: logoAp, logoWeb: logoUri(logoAp), width: 30, height: 18, labelDy: 9, blend: true },
  { key: 'bbc', gx: -2, gy: 64, dx: -4, dy: 10, label: 'BBC', labelDx: -23, labelAlign: 'end', logo: logoBbc, logoWeb: logoUri(logoBbc), width: 30, height: 12, labelDy: 10, blend: true },
  { key: 'nyt', gx: -14, gy: 50, dx: -10, dy: -6, label: 'New York Times', labelDx: -26, labelAlign: 'end', logo: logoNyt, logoWeb: logoUri(logoNyt), width: 42, height: 42, labelDy: 13 },
  { key: 'politico', gx: -2, gy: 44, dx: 10, dy: 10, label: 'Politico', labelDx: 23, labelAlign: 'start', logo: logoPolitico, logoWeb: logoUri(logoPolitico), width: 38, height: 10, labelDy: 10, blend: true },
  { key: 'wsj', gx: 22, gy: 42, dx: 10, dy: -6, label: 'WSJ', labelDx: 23, labelAlign: 'start', logo: logoWsj, logoWeb: logoUri(logoWsj), width: 34, height: 34, labelDy: 11, blend: true },
  { key: 'cnn', gx: -18, gy: 34, dx: -10, dy: 2, label: 'CNN', labelDx: -21, labelAlign: 'end', logo: logoCnn, logoWeb: logoUri(logoCnn), width: 34, height: 18, labelDy: 10, blend: true },
  { key: 'fox', gx: 50, gy: 28, dx: 14, dy: -4, label: 'Fox News', labelDx: 23, labelAlign: 'start', logo: logoFox, logoWeb: logoUri(logoFox), width: 34, height: 34, labelDy: 10, blend: true },
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
  const { isGuestMode, user, profile } = useAuth();
  const { width: windowWidth, height: windowHeight } = useWindowDimensions();
  const isNarrowScreen = windowWidth < 350;
  const graphMinSize = windowHeight < 620 ? 184 : windowHeight < 740 ? 206 : 240;
  const {
    preferences,
    applyQueryPreferences,
    applyTopNewsPreferences,
    syncTopNewsFallbackState,
  } = useNewsPreferences();
  const isFocused = useIsFocused();
  const [graphViewport, setGraphViewport] = useState({ width: 0, height: 0 });
  const graphWidth = useMemo(() => {
    const fallbackWidth = Math.min(
      Math.max(windowWidth - 34, graphMinSize),
      GRAPH_MAX_SIZE,
    );
    const viewportHeightLimit = Math.min(
      Math.max(windowHeight - 388, graphMinSize),
      GRAPH_MAX_SIZE,
    );
    const availableWidth = Math.max(graphViewport.width - 12, 0);
    const availableHeight = Math.max(
      Math.min(graphViewport.height - 24, viewportHeightLimit),
      0,
    );
    const availableSquare = Math.min(
      availableWidth || fallbackWidth,
      availableHeight || viewportHeightLimit || fallbackWidth,
    );

    return Math.min(
      Math.max(availableSquare || FALLBACK_GRAPH_SIZE, graphMinSize),
      GRAPH_MAX_SIZE,
    );
  }, [graphMinSize, graphViewport.height, graphViewport.width, windowHeight, windowWidth]);
  const graphHeight = graphWidth;
  const graphScale = clamp(graphWidth / FALLBACK_GRAPH_SIZE, 0.58, 1.12);
  const graphAxisInset = clamp(graphWidth * 0.1, 20, 34);
  const graphSizeRef = useRef({ width: graphWidth, height: graphHeight });
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
  const [isSearchFocused, setIsSearchFocused] = useState(false);
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
  const [localStreakCount, setLocalStreakCount] = useState(0);
  const [seedTopics, setSeedTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [allTopics, setAllTopics] = useState<string[]>(FALLBACK_TOPICS);
  const [trendingTopics, setTrendingTopics] = useState<string[]>(FALLBACK_TRENDING_TOPICS);
  const [digests, setDigests] = useState<DigestPreset[]>([]);
  const [radius, setRadius] = useState(initialGraphState.radius / 100);
  const [hasAppliedTopNewsFilter, setHasAppliedTopNewsFilter] = useState(
    () => initialGraphState.hasAppliedTopNewsFilter,
  );
  const sliderTrackWidth = Math.min(Math.max(windowWidth - 176, 150), 320);
  const [pinX, setPinX] = useState(initialPin.x);
  const [pinY, setPinY] = useState(initialPin.y);
  const animatedPinX = useSharedValue(initialPin.x);
  const animatedPinY = useSharedValue(initialPin.y);
  const animatedRadius = useSharedValue(initialGraphState.radius / 100);
  const graphResetRevision = useSharedValue(0);
  const activeGraphGestureRevision = useSharedValue(0);
  const activeSliderGestureRevision = useSharedValue(0);
  const graphResetRevisionRef = useRef(0);
  const isDefaultResetLockedRef = useRef(false);
  const graphPositionRef = useRef<GraphPoint>(initialGraphState.graphPosition);
  const previousGraphSizeRef = useRef({
    width: graphWidth,
    height: graphHeight,
  });
  const currentGraphPosition = useMemo(
    () => isDefaultResetLockedRef.current
      ? { ...DEFAULT_GRAPH_POSITION }
      : canvasToGraphPoint(pinX, pinY, graphWidth, graphHeight),
    [pinX, pinY, graphWidth, graphHeight],
  );
  const [initialState, setInitialState] = useState({
    topics: initialGraphState.selectedTopics,
    promptTerms: initialGraphState.promptTerms,
    position: initialGraphState.graphPosition,
    radius: initialGraphState.radius,
  });

  useEffect(() => {
    graphSizeRef.current = { width: graphWidth, height: graphHeight };
  }, [graphHeight, graphWidth]);

  const syncGraphStateFromPreferences = useCallback(() => {
    const nextGraphState = readPersistedGraphState();
    isDefaultResetLockedRef.current = false;
    graphPositionRef.current = { ...nextGraphState.graphPosition };
    const currentGraphSize = graphSizeRef.current;
    const nextPin = graphPointToCanvas(
      nextGraphState.graphPosition,
      currentGraphSize.width,
      currentGraphSize.height,
    );

    setSelectedTopics(nextGraphState.selectedTopics);
    setPromptTerms(nextGraphState.promptTerms);
    setPinX(nextPin.x);
    setPinY(nextPin.y);
    setRadius(nextGraphState.radius / 100);
    animatedPinX.value = nextPin.x;
    animatedPinY.value = nextPin.y;
    animatedRadius.value = nextGraphState.radius / 100;
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
  }, [animatedPinX, animatedPinY, animatedRadius, readPersistedGraphState]);

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
    if (!user?.id) {
      setDigests([]);
      return;
    }

    try {
      const normalizedDigests = readDigestPresets(user.id)
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
    } catch {}
  }, [graphHeight, graphWidth, user?.id]);

  const persistDigests = (nextDigests: DigestPreset[]) => {
    setDigests(nextDigests);
    if (user?.id) {
      writeDigestPresets(user.id, nextDigests);
    }
  };

  const loadTopics = useCallback(async (isActive: () => boolean) => {
    const applyTopics = async () => {
      await hydrateDiscoveryCache();
      const cachedTopics = readCachedTopics();
      const cachedTrendingTopics = readCachedTrendingTopics();

      if (isActive()) {
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

        if (isActive()) {
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
        }
      } catch {
        if (isActive()) {
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
        }
      }
    };

    return applyTopics();
  }, []);

  useEffect(() => {
    let isActive = true;
    const task = InteractionManager.runAfterInteractions(() => {
      void loadTopics(() => isActive);
    });

    return () => {
      isActive = false;
      task.cancel();
    };
  }, [loadTopics]);

  useEffect(() => {
    let isActive = true;

    void readReadingActivitySummary(user?.id).then((summary) => {
      if (!isActive) return;
      setLocalStreakCount(summary.currentStreak);
    });

    const unsubscribe = subscribeReadingActivity(user?.id, (summary) => {
      setLocalStreakCount(summary.currentStreak);
    });

    return () => {
      isActive = false;
      unsubscribe();
    };
  }, [user?.id]);

  const query = search.toLowerCase().trim();
  const visibleTopics = useMemo(() => {
    const pool = query ? allTopics.filter(topic => topic.toLowerCase().includes(query)) : seedTopics;
    // Rendering the entire topic catalog on every keystroke can make the
    // mobile search field lag or even force the app to reload. The direct
    // article-search action remains available above this short suggestion set.
    return pool
      .filter(topic => !selectedTopics.includes(normalizeTopicId(topic)))
      .slice(0, MAX_TOPIC_SUGGESTIONS);
  }, [allTopics, query, seedTopics, selectedTopics]);

  const exactMatchingTopicLabel = useMemo(
    () => allTopics.find((topic) => normalizeTopicId(topic) === normalizeTopicId(search.trim())) || null,
    [allTopics, search],
  );
  const isAlreadySelectedTopic = useMemo(
    () => Boolean(exactMatchingTopicLabel && selectedTopics.includes(normalizeTopicId(exactMatchingTopicLabel))),
    [exactMatchingTopicLabel, selectedTopics],
  );

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
      : !isDefaultGraphSelection(currentGraphPosition, radiusPercent)
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

  const dismissSearch = useCallback(() => {
    cancelScheduledDropdownClose();
    searchInputRef.current?.blur();
    Keyboard.dismiss();
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
    graphPositionRef.current = isDefaultResetLockedRef.current
      ? { ...DEFAULT_GRAPH_POSITION }
      : canvasToGraphPoint(pinX, pinY, graphWidth, graphHeight);
    // A canvas resize must preserve the normalized position already in the ref.
    // The resize effect below converts that position back to the new pixel size.
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

    const nextPosition = isDefaultResetLockedRef.current
      ? DEFAULT_GRAPH_POSITION
      : graphPositionRef.current;
    const nextPin = graphPointToCanvas(nextPosition, graphWidth, graphHeight);

    setPinX(nextPin.x);
    setPinY(nextPin.y);
    animatedPinX.value = nextPin.x;
    animatedPinY.value = nextPin.y;
  }, [animatedPinX, animatedPinY, graphHeight, graphWidth]);

  const commitGraphPosition = useCallback((x: number, y: number, revision: number) => {
    if (revision !== graphResetRevisionRef.current) return;
    isDefaultResetLockedRef.current = false;
    const nextX = clamp(x, 0, graphWidth);
    const nextY = clamp(y, 0, graphHeight);
    setPinX(nextX);
    setPinY(nextY);
    graphPositionRef.current = canvasToGraphPoint(nextX, nextY, graphWidth, graphHeight);
  }, [graphHeight, graphWidth]);

  const commitRadius = useCallback((nextRadius: number, revision: number) => {
    if (revision !== graphResetRevisionRef.current) return;
    isDefaultResetLockedRef.current = false;
    setRadius(nextRadius);
  }, []);

  const graphPanGesture = useMemo(
    () => Gesture.Pan()
      .minDistance(4)
      .onBegin((event) => {
        activeGraphGestureRevision.value = graphResetRevision.value;
        animatedPinX.value = Math.max(0, Math.min(graphWidth, event.x));
        animatedPinY.value = Math.max(0, Math.min(graphHeight, event.y));
      })
      .onUpdate((event) => {
        animatedPinX.value = Math.max(0, Math.min(graphWidth, event.x));
        animatedPinY.value = Math.max(0, Math.min(graphHeight, event.y));
      })
      .onFinalize(() => {
        runOnJS(commitGraphPosition)(
          animatedPinX.value,
          animatedPinY.value,
          activeGraphGestureRevision.value,
        );
      }),
    [
      activeGraphGestureRevision,
      animatedPinX,
      animatedPinY,
      commitGraphPosition,
      graphHeight,
      graphResetRevision,
      graphWidth,
    ],
  );

  const graphTapGesture = useMemo(
    () => Gesture.Tap()
      .maxDistance(8)
      .onBegin(() => {
        activeGraphGestureRevision.value = graphResetRevision.value;
      })
      .onEnd((event, success) => {
        if (!success) return;
        animatedPinX.value = Math.max(0, Math.min(graphWidth, event.x));
        animatedPinY.value = Math.max(0, Math.min(graphHeight, event.y));
        runOnJS(commitGraphPosition)(
          animatedPinX.value,
          animatedPinY.value,
          activeGraphGestureRevision.value,
        );
      }),
    [
      activeGraphGestureRevision,
      animatedPinX,
      animatedPinY,
      commitGraphPosition,
      graphHeight,
      graphResetRevision,
      graphWidth,
    ],
  );

  const graphGesture = useMemo(
    () => Gesture.Race(graphPanGesture, graphTapGesture),
    [graphPanGesture, graphTapGesture],
  );

  const sliderGesture = useMemo(
    () => Gesture.Pan()
      .minDistance(0)
      .onBegin((event) => {
        activeSliderGestureRevision.value = graphResetRevision.value;
        animatedRadius.value = Math.max(0.05, Math.min(1, event.x / sliderTrackWidth));
      })
      .onUpdate((event) => {
        animatedRadius.value = Math.max(0.05, Math.min(1, event.x / sliderTrackWidth));
      })
      .onFinalize(() => {
        const stepped = Math.max(0.05, Math.min(1, Math.round(animatedRadius.value * 20) / 20));
        animatedRadius.value = withTiming(stepped, { duration: 120 });
        runOnJS(commitRadius)(stepped, activeSliderGestureRevision.value);
      }),
    [
      activeSliderGestureRevision,
      animatedRadius,
      commitRadius,
      graphResetRevision,
      sliderTrackWidth,
    ],
  );

  const radiusCircleAnimatedProps = useAnimatedProps(() => ({
    cx: animatedPinX.value,
    cy: animatedPinY.value,
    r: animatedRadius.value * (graphWidth * 0.32),
  }));
  const markerCircleAnimatedProps = useAnimatedProps(() => ({
    cx: animatedPinX.value,
    cy: animatedPinY.value,
  }));
  const sliderFillAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    width: animatedRadius.value * sliderTrackWidth,
  }));
  const sliderThumbAnimatedStyle = useAnimatedStyle<ViewStyle>(() => ({
    transform: [{ translateX: animatedRadius.value * sliderTrackWidth }],
  }));

  const handleTopicSelect = (topic: string) => {
    const normalizedTopic = normalizeTopicId(topic);
    if (!selectedTopics.includes(normalizedTopic)) {
      setSelectedTopics((prev) => [...prev, normalizedTopic]);
    }
    setSearch('');
    searchInputRef.current?.blur();
    closeDropdown();
  };

  const removeTopic = (topic: string) => {
    setSelectedTopics((prev) => prev.filter((item) => item !== topic));
  };

  const removePrompt = (term: string) => {
    setPromptTerms((prev) => prev.filter((item) => item !== term));
  };

  const applyGraphChanges = (
    nextTopics: string[],
    nextPromptTerms: string[],
  ) => {
    if (isApplying) return;
    setIsApplying(true);

    try {
      const nextRecommendationRequest: RecommendationRequestState = {
        prompt: nextPromptTerms.join('; '),
        topics: nextTopics,
        position: {
          x: currentGraphPosition.x / 100,
          y: currentGraphPosition.y / 100,
        },
        radius: radiusPercent / 100,
      };
      const nextHasSearchCriteria = nextTopics.length > 0 || nextPromptTerms.length > 0;
      const nextTopNewsGraphFilter =
        nextHasSearchCriteria || isDefaultGraphSelection(currentGraphPosition, radiusPercent)
          ? null
          : {
              position: { ...currentGraphPosition },
              radius: radiusPercent,
            };

      setInitialState({
        topics: [...nextTopics],
        promptTerms: [...nextPromptTerms],
        position: { ...currentGraphPosition },
        radius: radiusPercent,
      });

      if (nextHasSearchCriteria) {
        setHasAppliedTopNewsFilter(false);
        closeDropdown();
        const prefetchedArticles = getRecommenderConfig().isEnabled
          ? null
          : buildSafeModePrefetchedArticles({
              topics: nextTopics,
              promptTerms: nextPromptTerms,
              position: currentGraphPosition,
              radius: radiusPercent,
            });
        applyQueryPreferences({
          activeQuery: {
            topics: nextTopics,
            promptTerms: nextPromptTerms,
          },
          recommendationRequest: nextRecommendationRequest,
          prefetchedArticles,
        });

        router.navigate('/');
        return;
      }

      setHasAppliedTopNewsFilter(Boolean(nextTopNewsGraphFilter));
      closeDropdown();
      applyTopNewsPreferences(nextTopNewsGraphFilter);

      router.navigate('/');
    } catch (error) {
      console.warn('[GraphScreen] Failed to apply changes', error);
      setIsApplying(false);
      Alert.alert(
        'Could not apply changes',
        'Please try again.',
      );
    }
  };

  const handleApplyChanges = () => {
    applyGraphChanges(selectedTopics, promptTerms);
  };

  const handleGraphSearch = async () => {
    const trimmed = search.trim();
    if (!trimmed) {
      dismissSearch();
      return;
    }

    if (isApplying) return;
    setIsApplying(true);

    const matchedTopic = allTopics.find(
      (topic) => normalizeTopicId(topic) === normalizeTopicId(trimmed),
    );
    const normalizedTopic = matchedTopic ? normalizeTopicId(matchedTopic) : null;
    const nextTopics = normalizedTopic && !selectedTopics.includes(normalizedTopic)
      ? [...selectedTopics, normalizedTopic]
      : selectedTopics;
    const nextPromptTerms = matchedTopic || promptTerms.includes(trimmed)
      ? promptTerms
      : [...promptTerms, trimmed];

    const nextRecommendationRequest: RecommendationRequestState = {
      prompt: trimmed,
      topics: nextTopics,
      position: {
        x: currentGraphPosition.x / 100,
        y: currentGraphPosition.y / 100,
      },
      radius: radiusPercent / 100,
      searchStrategy: 'deterministic',
    };

    try {
      // This is the only live lookup a free-text Graph search performs. The
      // helper uses the five-minute article cache and never calls AI.
      const prefetchedArticles = await searchGraphArticles(trimmed, {
        position: { ...currentGraphPosition },
        radius: radiusPercent,
      });

      setInitialState({
        topics: [...nextTopics],
        promptTerms: [...nextPromptTerms],
        position: { ...currentGraphPosition },
        radius: radiusPercent,
      });
      setSelectedTopics(nextTopics);
      setPromptTerms(nextPromptTerms);
      setSearch('');
      dismissSearch();
      closeDropdown();
      setHasAppliedTopNewsFilter(false);
      applyQueryPreferences({
        activeQuery: {
          topics: nextTopics,
          promptTerms: nextPromptTerms,
        },
        recommendationRequest: nextRecommendationRequest,
        prefetchedArticles,
      });
      router.navigate('/');
    } catch (error) {
      console.warn('[GraphScreen] Text search failed', error);
      Alert.alert(
        'Search unavailable',
        'We could not load articles right now. Please try again.',
      );
    } finally {
      setIsApplying(false);
    }
  };

  const handleTopNewsReset = () => {
    graphResetRevisionRef.current += 1;
    graphResetRevision.value = graphResetRevisionRef.current;
    isDefaultResetLockedRef.current = true;
    const defaultPin = graphPointToCanvas(
      DEFAULT_GRAPH_POSITION,
      graphWidth,
      graphHeight,
    );
    setPinX(defaultPin.x);
    setPinY(defaultPin.y);
    setRadius(DEFAULT_GRAPH_RADIUS / 100);
    animatedPinX.value = defaultPin.x;
    animatedPinY.value = defaultPin.y;
    animatedRadius.value = DEFAULT_GRAPH_RADIUS / 100;
    graphPositionRef.current = { ...DEFAULT_GRAPH_POSITION };
    setHasAppliedTopNewsFilter(false);
    closeDropdown();
    syncTopNewsFallbackState(null);
  };

  const handleOpenDailyDigest = useCallback(() => {
    void writeDailyDigestOpenRequest(true);
    router.navigate('/');
  }, []);

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
    isDefaultResetLockedRef.current = false;
    graphPositionRef.current = { ...preset.position };
    const point = graphPointToCanvas(preset.position, graphWidth, graphHeight);
    setSelectedTopics(preset.topics.map(normalizeTopicId));
    setPromptTerms([]);
    setPinX(point.x);
    setPinY(point.y);
    setRadius(preset.radius / 100);
    animatedPinX.value = point.x;
    animatedPinY.value = point.y;
    animatedRadius.value = preset.radius / 100;
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
        width: outlet.width * graphScale,
        height: outlet.height * graphScale,
        x: graphToSvg(outlet.gx, graphWidth) + (outlet.dx ?? 0) * graphScale,
        y: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy * graphScale,
        imageX: graphToSvg(outlet.gx, graphWidth) + (outlet.dx ?? 0) * graphScale - (outlet.width * graphScale) / 2,
        imageY: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy * graphScale - (outlet.height * graphScale) / 2,
        labelX: graphToSvg(outlet.gx, graphWidth) + (outlet.dx ?? 0) * graphScale + (outlet.labelDx ?? 0) * graphScale,
        labelY: graphHeight - graphToSvg(outlet.gy, graphHeight) + outlet.dy * graphScale + (outlet.height * graphScale) / 2 + (outlet.labelDy ?? 10) * graphScale,
      })),
    [graphHeight, graphScale, graphWidth],
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

      <Pressable onPress={dismissSearch}>
      <View style={[s.header, isNarrowScreen && s.headerNarrow, { borderBottomColor: PAGE.border }]}>
        <View style={[s.headerLeft, isNarrowScreen && s.headerSideNarrow]}>
          {isGuestMode || !user ? (
            <Link href={buildHref('/login', { returnTo: '/graph' })} asChild>
              <TouchableOpacity
                style={s.signInBtn}
                accessibilityRole="link"
                accessibilityLabel="Sign in"
              >
                <Text style={s.signInText}>Sign In</Text>
              </TouchableOpacity>
            </Link>
          ) : (
            <>
              <TouchableOpacity
                style={s.headerIcon}
                onPress={() => router.push('/profile')}
                accessibilityRole="button"
                accessibilityLabel="Open profile"
              >
                <Ionicons name="person-outline" size={20} color={PAGE.text} />
              </TouchableOpacity>
              <View style={[s.streakPill, { backgroundColor: '#E9EDD8', borderColor: '#D9DEC5' }]}>
                <Ionicons name="flame-outline" size={15} color="#8DAE73" />
                <Text style={s.streakText}>{Math.max(profile?.reading_streak ?? 0, localStreakCount)}</Text>
              </View>
            </>
          )}
        </View>
        <Text style={[s.headerTitle, isNarrowScreen && s.headerTitleNarrow]}>Praxis</Text>
        <View style={[s.headerRight, isNarrowScreen && s.headerSideNarrow]}>
          {isGuestMode || !user ? (
            <Link href={buildHref('/login', { returnTo: '/saved' })} asChild>
              <TouchableOpacity
                style={s.headerIcon}
                accessibilityRole="link"
                accessibilityLabel="Sign in to view saved articles"
              >
                <Ionicons name="bookmark-outline" size={20} color={PAGE.text} />
              </TouchableOpacity>
            </Link>
          ) : (
            <TouchableOpacity
              style={s.headerIcon}
              onPress={() => router.push('saved' as any)}
              accessibilityRole="button"
              accessibilityLabel="Open saved articles"
            >
              <Ionicons name="bookmark-outline" size={20} color={PAGE.text} />
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={s.headerIcon}
            onPress={() => router.push('/search')}
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
          <View style={s.searchFieldWrap}>
            <View style={[s.searchShell, { borderColor: PAGE.chipBorder }]}>
              <Ionicons name="search-outline" size={18} color={PAGE.textMuted} />
              <TextInput
                ref={searchInputRef}
                value={search}
                onChangeText={(value) => {
                  setSearch(value);
                  if (!isDropdownOpen) openDropdown();
                }}
                onFocus={() => {
                  setIsSearchFocused(true);
                  openDropdown();
                }}
                onBlur={() => {
                  setIsSearchFocused(false);
                  scheduleDropdownClose();
                }}
                onSubmitEditing={handleGraphSearch}
                placeholder="Search topics or add keywords..."
                placeholderTextColor={PAGE.textMuted}
                style={s.searchInput}
                blurOnSubmit
                inputAccessoryViewID={Platform.OS === 'ios' ? SEARCH_INPUT_ACCESSORY_ID : undefined}
                returnKeyType="search"
                testID="graph-search-input"
                accessibilityLabel="Search topics or add keywords"
              />
              {isSearchFocused ? (
                <TouchableOpacity
                  onPress={dismissSearch}
                  style={s.clearButton}
                  accessibilityRole="button"
                  accessibilityLabel="Close topic search and hide keyboard"
                >
                  <Ionicons name="close" size={16} color={PAGE.textMuted} />
                </TouchableOpacity>
              ) : null}
            </View>

            {isDropdownOpen ? (
              <View style={s.dropdownOverlay} onTouchStart={cancelScheduledDropdownClose}>
                <ScrollView
                  style={s.dropdown}
                  contentContainerStyle={s.dropdownContent}
                  showsVerticalScrollIndicator
                  nestedScrollEnabled
                  keyboardShouldPersistTaps="always"
                >
                  {!query || digests.length > 0 || hasSearchCriteria ? (
                    <View style={s.presetsBlock}>
                      {digests.length > 0 || (query && hasSearchCriteria) ? (
                        <Text style={s.dropdownLabel}>Saved presets</Text>
                      ) : null}
                      <View style={s.presetsRow}>
                        {!query ? (
                          <TouchableOpacity
                            onPress={handleOpenDailyDigest}
                            style={s.dailyDigestShortcutChip}
                            accessibilityRole="button"
                            accessibilityLabel="Open today's Daily Digest"
                            testID="graph-daily-digest"
                          >
                            <Ionicons name="sparkles-outline" size={13} color="#5F438E" />
                            <Text style={s.dailyDigestShortcutText}>Daily Digest</Text>
                          </TouchableOpacity>
                        ) : null}
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
                              accessibilityRole="button"
                              accessibilityLabel={`Delete preset ${preset.name}`}
                            >
                              <Ionicons name="close" size={10} color={PAGE.textMuted} />
                            </TouchableOpacity>
                          </View>
                        ))}
                      </View>
                      {digests.length === 0 && query && hasSearchCriteria ? (
                        <Text style={s.emptyDropdownText}>No saved presets yet.</Text>
                      ) : null}
                    </View>
                  ) : null}

                  {query ? (
                    <TouchableOpacity
                      onPress={handleGraphSearch}
                      disabled={isApplying}
                      style={s.dropdownSearchRow}
                      accessibilityRole="button"
                      accessibilityLabel={`Search articles for ${search.trim()}`}
                      accessibilityState={{ disabled: isApplying, busy: isApplying }}
                    >
                      <View style={s.dropdownSearchLeft}>
                        <Ionicons name="search-outline" size={14} color={PAGE.textMuted} />
                        <Text style={s.dropdownSearchText} numberOfLines={1}>
                          {isApplying ? 'Searching articles…' : <>Search articles for "<Text style={s.dropdownSearchTerm}>{search.trim()}</Text>"</>}
                        </Text>
                      </View>
                      {isApplying ? (
                        <ActivityIndicator size="small" color={PAGE.green} />
                      ) : (
                        <Ionicons name="arrow-forward" size={15} color={PAGE.textMuted} />
                      )}
                    </TouchableOpacity>
                  ) : null}

                  {visibleTopics.length > 0 ? (
                    <View style={s.dropdownTopicsBlock}>
                      <Text style={s.dropdownLabel}>{query ? 'Matching topics' : 'Categories'}</Text>
                      <View style={s.dropdownTopics}>
                        {visibleTopics.map((topic) => (
                          <TouchableOpacity
                            key={topic}
                            style={s.dropdownTopicChip}
                            onPress={() => handleTopicSelect(topic)}
                            accessibilityRole="button"
                            accessibilityLabel={`Select topic ${topic}`}
                            testID={`graph-topic-${topicToTestId(topic)}`}
                          >
                            <Text style={s.dropdownTopicText}>{topic}</Text>
                          </TouchableOpacity>
                        ))}
                      </View>
                    </View>
                  ) : query ? (
                    <Text style={[s.emptyDropdownText, s.emptyDropdownCentered]}>
                      {isAlreadySelectedTopic ? 'Topic already selected' : 'No matching topics'}
                    </Text>
                  ) : null}
                </ScrollView>
              </View>
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
            <Ionicons name="add" size={18} color={hasSearchCriteria ? PAGE.green : PAGE.textSoft} />
            <Text style={[s.saveButtonText, { color: hasSearchCriteria ? '#5D7650' : PAGE.textSoft }]}>Save</Text>
          </TouchableOpacity>
        </View>

        <View style={s.selectedFiltersSection}>
          {topNewsFilterState ? (
            <TouchableOpacity
              onPress={handleTopNewsReset}
              style={s.topNewsPill}
              accessibilityRole="button"
              accessibilityLabel="Reset Top News to defaults"
              testID="graph-top-news-reset"
            >
              <Ionicons name="flame-outline" size={14} color="#D57A24" />
              <Text style={s.topNewsPillText}>Top News</Text>
            </TouchableOpacity>
          ) : hasSearchCriteria ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={s.selectedFiltersRow}
            >
              {selectedTopics.map((topic) => (
                <TouchableOpacity
                  key={topic}
                  onPress={() => removeTopic(topic)}
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
                  onPress={() => removePrompt(term)}
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
          ) : null}
        </View>

        <View
          style={[
            s.filterArea,
            (topNewsFilterState || hasSearchCriteria) && s.filterAreaBelowSelected,
          ]}
        >
          {availableTrendingTopics.length > 0 ? (
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
                  onPress={() => handleTopicSelect(topic)}
                  accessibilityRole="button"
                  accessibilityLabel={`Select trending topic ${topic}`}
                  testID={`graph-trending-${topicToTestId(topic)}`}
                >
                  <Text style={s.topicChipText}>{topic}</Text>
                  <Text style={s.topicChipPlus}>+</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          ) : null}
        </View>
      </View>

      {Platform.OS === 'ios' ? (
        <InputAccessoryView nativeID={SEARCH_INPUT_ACCESSORY_ID}>
          <View style={s.keyboardAccessory}>
            <TouchableOpacity
              onPress={dismissSearch}
              accessibilityRole="button"
              accessibilityLabel="Done typing"
              style={s.keyboardDoneButton}
            >
              <Text style={s.keyboardDoneText}>Done</Text>
            </TouchableOpacity>
          </View>
        </InputAccessoryView>
      ) : null}

      <Pressable style={s.graphSection} onPress={dismissSearch}>
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
          >
            <TouchableOpacity
              style={[
                s.helpButton,
                {
                  borderColor: PAGE.chipBorder,
                  width: clamp(44 * graphScale, 34, 44),
                  height: clamp(44 * graphScale, 34, 44),
                  borderRadius: clamp(22 * graphScale, 17, 22),
                },
              ]}
              activeOpacity={0.85}
              onPress={() => setIsHelpOpen(true)}
            >
              <Ionicons name="help-circle-outline" size={clamp(26 * graphScale, 20, 26)} color={PAGE.text} />
            </TouchableOpacity>
            <GestureDetector gesture={graphGesture}>
              <Animated.View style={{ width: graphWidth, height: graphHeight }}>
                <Svg width={graphWidth} height={graphHeight}>
            <Line x1={centerX} y1={graphAxisInset} x2={centerX} y2={graphHeight - graphAxisInset} stroke="#D3CCC1" strokeWidth={2} />
            <Line x1={graphAxisInset} y1={centerY} x2={graphWidth - graphAxisInset} y2={centerY} stroke="#D3CCC1" strokeWidth={2} />

            <AnimatedCircle
              animatedProps={radiusCircleAnimatedProps}
              fill="rgba(141,174,115,0.08)"
              stroke={PAGE.green}
              strokeWidth={3}
              strokeDasharray="6,5"
            />
            <AnimatedCircle animatedProps={markerCircleAnimatedProps} r={clamp(16 * graphScale, 11, 16)} fill={PAGE.green} stroke="#FFFFFF" strokeWidth={clamp(5 * graphScale, 3.5, 5)} />
            {positionedOutlets.map((outlet) => (
              <React.Fragment key={outlet.key}>
                <SvgImage
                  x={outlet.imageX}
                  y={outlet.imageY}
                  width={outlet.width}
                  height={outlet.height}
                  href={Platform.OS === 'web' ? outlet.logoWeb : outlet.logo}
                  preserveAspectRatio="xMidYMid meet"
                  opacity={0.98}
                />
                <SvgText
                  x={outlet.labelX}
                  y={outlet.labelY}
                  textAnchor={(outlet.labelAlign ?? 'middle') as 'start' | 'middle' | 'end'}
                  fill={PAGE.textMuted}
                  opacity={0.86}
                  fontSize={clamp(9.5 * graphScale, 7.5, 10.5)}
                  fontWeight="500"
                >
                  {outlet.label}
                </SvgText>
              </React.Fragment>
            ))}
                </Svg>
              </Animated.View>
            </GestureDetector>
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

        <View style={s.sliderSection}>
          <View style={s.sliderInner}>
            <Text style={s.sliderLabel}>Radius</Text>
            <View style={s.sliderTrackWrap}>
              <GestureDetector gesture={sliderGesture}>
                <Animated.View style={[s.sliderTrack, { backgroundColor: PAGE.sliderTrack, width: sliderTrackWidth }]}>
                  <Animated.View style={[s.sliderFill, { backgroundColor: PAGE.green }, sliderFillAnimatedStyle]} />
                  <Animated.View style={[s.sliderThumb, { borderColor: PAGE.green }, sliderThumbAnimatedStyle]} />
                </Animated.View>
              </GestureDetector>
            </View>
            <View style={[s.percentPill, { borderColor: PAGE.chipBorder }]}>
              <Text style={s.percentText}>{Math.round(radius * 100)}%</Text>
            </View>
          </View>
        </View>
      </Pressable>

      <View
        style={[s.applyBar, !(hasChanges || isApplying) && s.applyBarPlaceholder]}
        pointerEvents={hasChanges || isApplying ? 'auto' : 'none'}
      >
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

      {isHelpOpen ? (
        <View style={s.modalWrap} pointerEvents="box-none">
          <View style={s.helpModal}>
            <ScrollView
              showsVerticalScrollIndicator={false}
              contentContainerStyle={s.helpModalContent}
            >
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
            </ScrollView>
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
                  router.push(buildHref('/login', { returnTo: '/graph' }));
                }}
              >
                <Text style={s.dialogPrimaryText}>Sign in</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      ) : null}

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
  headerNarrow: {
    height: 76,
    paddingHorizontal: 10,
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: '800',
    color: PAGE.text,
    letterSpacing: -0.5,
  },
  headerTitleNarrow: { fontSize: 20 },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    minWidth: 92,
  },
  headerSideNarrow: { minWidth: 78, gap: 2 },
  headerIcon: {
    width: 38,
    height: 38,
    alignItems: 'center',
    justifyContent: 'center',
  },
  signInBtn: {
    minHeight: 38,
    justifyContent: 'center',
    paddingRight: 8,
  },
  signInText: {
    fontSize: 15,
    fontWeight: '500',
    color: PAGE.text,
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
    // This is a stable stage for the optional filter rows. The rows themselves
    // float below Search, so Trending can sit directly below it when there is
    // no active filter without changing the map's available space.
    height: 136,
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
  searchFieldWrap: {
    flex: 1,
    position: 'relative',
    zIndex: 60,
  },
  searchShell: {
    width: '100%',
    height: 40,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FFFCF6',
  },
  searchInput: {
    flex: 1,
    fontSize: 14,
    color: PAGE.text,
  },
  clearButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F0E9DD',
    borderWidth: 1,
    borderColor: '#DDD4C5',
  },
  keyboardAccessory: {
    height: 42,
    backgroundColor: '#F7F3EA',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#DDD4C5',
    alignItems: 'flex-end',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  keyboardDoneButton: {
    minWidth: 56,
    minHeight: 32,
    alignItems: 'center',
    justifyContent: 'center',
  },
  keyboardDoneText: {
    color: '#58704E',
    fontSize: 16,
    fontWeight: '700',
  },
  saveButton: {
    height: 40,
    minWidth: 84,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 6,
    paddingHorizontal: 12,
  },
  saveButtonText: {
    color: PAGE.textSoft,
    fontSize: 14,
    fontWeight: '500',
  },
  dropdownOverlay: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 46,
    zIndex: 60,
  },
  dropdown: {
    maxHeight: 320,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E7DECF',
    backgroundColor: '#FFFCF6',
    shadowColor: '#A39B8E',
    shadowOpacity: 0.16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  dropdownContent: {
    padding: 12,
    gap: 12,
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
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E4DDD1',
    backgroundColor: '#F4EFE4',
    paddingHorizontal: 12,
    paddingVertical: 9,
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
    flexShrink: 1,
  },
  dropdownSearchTerm: {
    fontWeight: '600',
  },
  dropdownLabel: {
    fontSize: 12,
    color: PAGE.textMuted,
    fontWeight: '600',
    paddingHorizontal: 2,
  },
  dropdownTopicsBlock: {
    gap: 8,
  },
  dropdownTopics: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 7,
    paddingBottom: 4,
  },
  dropdownTopicChip: {
    borderRadius: 7,
    borderWidth: 1,
    borderColor: '#E3DACB',
    backgroundColor: '#FFFCF6',
    paddingHorizontal: 10,
    paddingVertical: 6,
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
  emptyDropdownCentered: {
    paddingVertical: 16,
    textAlign: 'center',
  },
  filterArea: {
    position: 'absolute',
    top: 60,
    left: 18,
    right: 0,
    minHeight: 30,
    justifyContent: 'center',
    zIndex: 10,
  },
  filterAreaBelowSelected: {
    top: 104,
  },
  selectedFiltersSection: {
    position: 'absolute',
    top: 60,
    left: 18,
    right: 0,
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
  dailyDigestShortcutChip: {
    alignSelf: 'flex-start',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#D9CFEB',
    backgroundColor: '#F7F2FC',
    paddingHorizontal: 12,
    paddingVertical: 7,
  },
  dailyDigestShortcutText: { color: '#5F438E', fontSize: 12, fontWeight: '700' },
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
    paddingTop: 2,
    paddingBottom: 8,
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
    maxHeight: '88%',
    borderRadius: 18,
    backgroundColor: '#F8F5EE',
    borderWidth: 1,
    borderColor: '#DDD4C5',
    shadowColor: '#312C26',
    shadowOpacity: 0.16,
    shadowRadius: 18,
    shadowOffset: { width: 0, height: 10 },
    elevation: 8,
  },
  helpModalContent: { paddingHorizontal: 22, paddingVertical: 20 },
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
    // Keep the larger map centered in the space between topic controls and
    // the Radius control rather than pinning it toward the top edge.
    justifyContent: 'center',
    maxWidth: 620,
    paddingHorizontal: 4,
    paddingTop: 4,
    paddingBottom: 6,
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
    paddingHorizontal: 24,
    paddingTop: 8,
    paddingBottom: 18,
    alignItems: 'center',
    flexShrink: 0,
  },
  sliderInner: {
    width: '100%',
    maxWidth: 480,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-start',
    gap: 10,
  },
  applyBar: {
    position: 'relative',
    zIndex: 12,
    elevation: 12,
    paddingHorizontal: 18,
    paddingBottom: 10,
    paddingTop: 2,
  },
  // Reserve this space even before a change is made. Otherwise the map moves
  // whenever filter chips or the Apply button enter/leave the layout.
  applyBarPlaceholder: {
    opacity: 0,
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
    width: 50,
    fontSize: 14,
    color: PAGE.textMuted,
    fontWeight: '500',
    lineHeight: 14,
  },
  sliderTrackWrap: {
    justifyContent: 'center',
    paddingVertical: 13,
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
    marginLeft: -14,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F7F3EA',
    borderWidth: 1,
    top: -10,
    shadowColor: '#8DAE73',
    shadowOpacity: 0,
    shadowRadius: 0,
    shadowOffset: { width: 0, height: 0 },
    elevation: 0,
  },
  percentPill: {
    minWidth: 54,
    height: 32,
    borderRadius: 999,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 8,
    backgroundColor: 'transparent',
  },
  percentText: {
    fontSize: 14,
    color: PAGE.text,
    fontWeight: '500',
  },
});
