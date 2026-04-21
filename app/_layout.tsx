import { useEffect } from 'react';
import { Stack, router, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
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

export default function RootLayout() {
  return (
    <ErrorBoundary>
    <GestureHandlerRootView style={{ flex: 1 }}>
      <AuthProvider>
        <RootRedirect />
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
