import { useEffect, useState } from 'react';
import * as Network from 'expo-network';

export function useNetworkStatus() {
  const [isConnected, setIsConnected] = useState<boolean | null>(null);

  const check = async () => {
    const state = await Network.getNetworkStateAsync();
    setIsConnected(state.isConnected ?? null);
  };

  useEffect(() => {
    check();
    // Poll every 5 seconds — expo-network doesn't have a subscription API
    const interval = setInterval(check, 5000);
    return () => clearInterval(interval);
  }, []);

  return { isConnected };
}
