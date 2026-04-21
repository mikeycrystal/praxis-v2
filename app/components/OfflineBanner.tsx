import { View, Text, StyleSheet, Animated } from 'react-native';
import { useEffect, useRef } from 'react';
import { useNetworkStatus } from '../hooks/useNetworkStatus';

export function OfflineBanner() {
  const { isConnected } = useNetworkStatus();
  const opacity = useRef(new Animated.Value(0)).current;
  const showBanner = isConnected === false;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: showBanner ? 1 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [showBanner]);

  return (
    <Animated.View style={[s.banner, { opacity }]} pointerEvents="none">
      <Text style={s.text}>No internet connection</Text>
    </Animated.View>
  );
}

const s = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0, left: 0, right: 0,
    backgroundColor: '#EF4444',
    paddingVertical: 6,
    alignItems: 'center',
    zIndex: 9999,
  },
  text: { color: '#FFFFFF', fontSize: 13, fontWeight: '600' },
});
