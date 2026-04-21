import { useEffect, useRef } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import * as Notifications from 'expo-notifications';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ErrorBoundary } from './components/ErrorBoundary';
import { OfflineBanner } from './components/OfflineBanner';

function RootRedirect() {
  const { session, profile, loading } = useAuth();
  const segments = useSegments();

  useEffect(() => {
    if (loading) return;

    const inAuth = segments[0] === '(auth)';
    const inTabs = segments[0] === '(tabs)';

    if (!session) {
      if (!inAuth) router.replace('/(auth)/login');
    } else if (session && profile && !profile.onboarding_complete) {
      router.replace('/(auth)/onboarding');
    } else if (session && !inTabs) {
      router.replace('/(tabs)');
    }
  }, [session, profile, loading, segments]);

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
        router.push({ pathname: '/chat/[id]', params: { userId: data.senderId } });
      } else if (data?.type === 'badge') {
        router.push('/(tabs)/profile');
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
        <RootRedirect />
        <PushNotificationHandler />
        <OfflineBanner />
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(auth)" />
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="article/[id]" options={{ presentation: 'modal' }} />
          <Stack.Screen name="article/ai-analysis" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/user-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/saved-articles" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/search" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/leaderboard" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/edit-profile" options={{ presentation: 'modal' }} />
          <Stack.Screen name="modal/change-password" options={{ presentation: 'modal' }} />
          <Stack.Screen name="chat/[id]" options={{ presentation: 'card' }} />
          <Stack.Screen name="modal/reading-activity" options={{ presentation: 'modal' }} />
        </Stack>
        <StatusBar style="auto" />
      </AuthProvider>
    </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
