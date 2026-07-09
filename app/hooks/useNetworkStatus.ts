import { useEffect, useState } from 'react';
import * as Network from 'expo-network';
import { Platform } from 'react-native';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const check = async () => {
    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ) {
        setIsConnected(true);
        return;
      }
      if (typeof navigator !== 'undefined' && typeof navigator.onLine === 'boolean') {
        setIsConnected(navigator.onLine);
        return;
      }
      setIsConnected(true);
      return;
    }

    const state = await Network.getNetworkStateAsync();
    setIsConnected(state.isConnected ?? null);
  };

  useEffect(() => {
    check();

    if (Platform.OS === 'web') {
      if (
        typeof window !== 'undefined' &&
        ['localhost', '127.0.0.1'].includes(window.location.hostname)
      ) {
        return undefined;
      }

      const handleOnline = () => setIsConnected(true);
      const handleOffline = () => setIsConnected(false);
      window.addEventListener('online', handleOnline);
      window.addEventListener('offline', handleOffline);
      return () => {
        window.removeEventListener('online', handleOnline);
        window.removeEventListener('offline', handleOffline);
      };
    }

    // Poll every 5 seconds — expo-network doesn't have a subscription API
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected };
}
