import './lib/webRuntimePolyfills';
import { useEffect, useRef } from 'react';
import { Stack, router, useGlobalSearchParams, usePathname, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { AppState, Platform } from 'react-native';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { NewsPreferencesProvider } from './context/NewsPreferencesContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';
import { BadgeCelebrationProvider } from './components/BadgeCelebration';
import { supabase } from './services/supabase';
import { endSession, startSession, trackPageView } from './lib/analytics';

function AnalyticsTracker() {
  const pathname = usePathname();

  useEffect(() => {
    void startSession();

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        void startSession();
      } else if (state === 'background') {
        void endSession();
      }
    });
    return () => subscription.remove();
  }, []);

  useEffect(() => {
    if (!pathname) return;
    void trackPageView(pathname);
  }, [pathname]);

  return null;
}

function AppLifecycleManager() {
  useEffect(() => {
    if (Platform.OS === 'web') return;

    const syncServices = (state: string) => {
      if (state === 'active') {
        supabase.auth.startAutoRefresh();
        if (!supabase.realtime.isConnected()) {
          supabase.realtime.connect();
        }
        return;
      }

      supabase.auth.stopAutoRefresh();
    };

    syncServices(AppState.currentState);
    const subscription = AppState.addEventListener('change', syncServices);
    return () => subscription.remove();
  }, []);

  return null;
}

function RootRedirect() {
  const { session, profile, loading, isGuestMode } = useAuth();
  const segments = useSegments();
  const params = useGlobalSearchParams<{ returnTo?: string }>();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';
    const inModal = segments[0] === 'modal';
    const inArticle = segments[0] === 'article';
    const inChat = segments[0] === 'chat';
    const inStory = segments[0] === 'story';
    const tabAliasSegments = new Set(['saved', 'graph', 'profile', 'search', 'social', 'topics']);
    const inTabAlias = tabAliasSegments.has(segments[0] ?? '');
    const inAppShell = inTabs || inTabAlias || inModal || inArticle || inChat || inStory;

    if (!session && !isGuestMode) {
      if (!inAuth) router.replace('/login');
    } else if (!session && isGuestMode) {
      if (!inAppShell && !inAuth) router.replace('/');
    } else if (session && !inAppShell) {
      const returnTo = typeof params.returnTo === 'string' ? params.returnTo : null;
      router.replace((returnTo || '/') as any);
    }
  }, [session, profile, loading, segments, isGuestMode, params.returnTo]);

  return null;
}

function PushNotificationHandler() {
  const notifResponseRef = useRef<Notifications.Subscription | null>(null);

  useEffect(() => {
    notifResponseRef.current = Notifications.addNotificationResponseReceivedListener(response => {
      const data = response.notification.request.content.data as Record<string, any>;
      if (data?.type === 'follow' && data?.followerId) {
        router.push({ pathname: '/modal/user-profile', params: { userId: data.followerId } });
      } else if (data?.type === 'message' && data?.senderId) {
        router.push({ pathname: '/chat/[id]', params: { id: data.senderId } });
      } else if (data?.type === 'badge') {
        router.push('/profile');
      }
    });
    return () => notifResponseRef.current?.remove();
  }, []);

  return null;
}

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <BadgeCelebrationProvider>
        <NewsPreferencesProvider>
          <RootRedirect />
          <AnalyticsTracker />
          <AppLifecycleManager />
          <PushNotificationHandler />
          <OfflineBanner />
          <Stack screenOptions={{ headerShown: false }}>
            <Stack.Screen name="(auth)" />
            <Stack.Screen name="(tabs)" />
            <Stack.Screen name="search" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="article/[id]" options={{ presentation: 'card', animation: 'slide_from_right' }} />
            <Stack.Screen name="story/[id]" options={{ animation: 'none' }} />
            <Stack.Screen name="article/ai-analysis" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/profile" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/user-profile" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/saved-articles" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/search" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/leaderboard" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/edit-profile" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/account-settings" options={{ presentation: 'transparentModal', animation: 'slide_from_bottom' }} />
            <Stack.Screen name="modal/follow-list" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/change-password" options={{ presentation: 'modal' }} />
            <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
            <Stack.Screen name="modal/reading-activity" options={{ presentation: 'modal' }} />
            <Stack.Screen name="modal/analytics" options={{ presentation: 'modal' }} />
          </Stack>
          <StatusBar style="dark" />
        </NewsPreferencesProvider>
        </BadgeCelebrationProvider>
      </AuthProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
