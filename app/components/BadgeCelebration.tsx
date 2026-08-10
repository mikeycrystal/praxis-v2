import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Dimensions, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

import { useAuth } from '../context/AuthContext';
import { supabase } from '../services/supabase';

type EarnedBadge = { id: string | number; badge_id: string; name?: string | null; icon?: string | null; description?: string | null };
type BadgeCelebrationContextValue = {
  announceAwardedBadgeIds: (badgeIds: string[]) => Promise<void>;
  celebrateDigestCompletion: () => void;
};

const BadgeCelebrationContext = createContext<BadgeCelebrationContextValue | null>(null);
const PARTICLES = Array.from({ length: 46 }, (_, index) => ({
  angle: (index / 46) * Math.PI * 2 + (index % 3) * 0.12,
  distance: 85 + (index % 7) * 21,
  color: ['#8EAF72', '#D9802E', '#7D5BB5', '#E8C75F', '#6F89B8'][index % 5],
  size: 5 + (index % 4) * 2,
}));
const GOAL_PARTICLES = Array.from({ length: 42 }, (_, index) => ({
  burst: index < 12 ? 0 : index < 24 ? 1 : 2,
  side: index < 12
    ? (index % 3 === 0 ? 1 : -1)
    : index < 24
      ? (index % 3 === 0 ? -1 : 1)
      : (index % 2 === 0 ? -1 : 1),
  spread: 50 + (index % 7) * 13,
  rise: 170 + (index % 7) * 20,
  drift: ((index % 5) - 2) * 8,
  color: ['#8EAF72', '#D9802E', '#E8D9B7', '#DDB84A', '#9B83B7'][index % 5],
  size: 1.75 + (index % 3) * 0.75,
}));

function GoalConfetti({ run }: { run: number }) {
  const particles = useRef(GOAL_PARTICLES.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    if (run === 0) return;
    particles.forEach((particle) => particle.setValue(0));
    Animated.parallel(particles.map((particle, index) => Animated.timing(particle, {
      toValue: 1,
      duration: 690 + (index % 3) * 38,
      delay: GOAL_PARTICLES[index].burst * 185 + (index % 3) * 5,
      useNativeDriver: true,
    }))).start();
  }, [particles, run]);
  if (run === 0) return null;
  const { width, height } = Dimensions.get('window');
  return <View pointerEvents="none" style={s.goalLayer}>{GOAL_PARTICLES.map((particle, index) => {
    const progress = particles[index];
    return <Animated.View key={index} style={[s.particle, {
      width: particle.size, height: particle.size * 1.55, backgroundColor: particle.color,
      left: width / 2 + particle.side * Math.min(width * 0.36, 154) - particle.size / 2,
      top: height * 0.66,
      transform: [
        { translateX: progress.interpolate({ inputRange: [0, 0.28, 1], outputRange: [0, particle.side * particle.spread * 0.58 + particle.drift, particle.side * particle.spread] }) },
        { translateY: progress.interpolate({ inputRange: [0, 0.46, 1], outputRange: [0, -particle.rise, -particle.rise * 0.76] }) },
        { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(index % 2 ? -1 : 1) * (210 + index * 21)}deg`] }) },
      ], opacity: progress.interpolate({ inputRange: [0, 0.025, 0.82, 1], outputRange: [0, 0.96, 0.82, 0] }),
    }]} />;
  })}</View>;
}

function CelebrationOverlay({ badge }: { badge: EarnedBadge | null }) {
  const opacity = useRef(new Animated.Value(0)).current;
  const bannerY = useRef(new Animated.Value(-26)).current;
  const particles = useRef(PARTICLES.map(() => new Animated.Value(0))).current;

  useEffect(() => {
    if (!badge) return;
    opacity.setValue(1); bannerY.setValue(-26); particles.forEach((particle) => particle.setValue(0));
    Animated.parallel([
      Animated.spring(bannerY, { toValue: 0, useNativeDriver: true, friction: 7, tension: 70 }),
      ...particles.map((particle, index) => Animated.timing(particle, { toValue: 1, duration: 980 + (index % 5) * 80, delay: (index % 6) * 18, useNativeDriver: true })),
    ]).start();
    const exit = setTimeout(() => Animated.parallel([
      Animated.timing(opacity, { toValue: 0, duration: 260, useNativeDriver: true }),
      Animated.timing(bannerY, { toValue: -20, duration: 260, useNativeDriver: true }),
    ]).start(), 4740);
    return () => clearTimeout(exit);
  }, [badge, bannerY, opacity, particles]);

  if (!badge) return null;
  const centerX = Dimensions.get('window').width / 2;
  return <View pointerEvents="none" style={s.overlay}>
    <Animated.View style={[s.confettiLayer, { opacity }]}>{PARTICLES.map((particle, index) => {
      const progress = particles[index];
      return <Animated.View key={index} style={[s.particle, {
        width: particle.size, height: particle.size * 1.65, backgroundColor: particle.color, left: centerX - particle.size / 2, top: 148,
        transform: [
          { translateX: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.cos(particle.angle) * particle.distance] }) },
          { translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [0, Math.sin(particle.angle) * particle.distance + 150] }) },
          { rotate: progress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${(index % 2 ? -1 : 1) * (200 + index * 17)}deg`] }) },
        ], opacity: progress.interpolate({ inputRange: [0, 0.72, 1], outputRange: [1, 1, 0] }),
      }]} />;
    })}</Animated.View>
    <Animated.View style={[s.banner, { opacity, transform: [{ translateY: bannerY }] }]}>
      <View style={s.iconCircle}><Text style={s.icon}>{badge.icon || '🏆'}</Text></View>
      <View style={s.copy}><Text style={s.eyebrow}>BADGE UNLOCKED</Text><Text style={s.name}>{badge.name || 'New achievement'}</Text>{badge.description ? <Text style={s.description} numberOfLines={1}>{badge.description}</Text> : null}</View>
      <Ionicons name="checkmark-circle" size={22} color="#6B9456" />
    </Animated.View>
  </View>;
}

export function BadgeCelebrationProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [queue, setQueue] = useState<EarnedBadge[]>([]);
  const [activeBadge, setActiveBadge] = useState<EarnedBadge | null>(null);
  const [digestCelebrationRun, setDigestCelebrationRun] = useState(0);
  const seenBadgeIds = useRef(new Set<string>());
  const readyUserId = useRef<string | null>(null);
  const enqueue = useCallback((badges: EarnedBadge[]) => {
    const unseen = badges.filter((badge) => {
      const key = String(badge.id || badge.badge_id);
      if (seenBadgeIds.current.has(key)) return false;
      seenBadgeIds.current.add(key); return true;
    });
    if (unseen.length) setQueue((current) => [...current, ...unseen]);
  }, []);
  const announceAwardedBadgeIds = useCallback(async (badgeIds: string[]) => {
    if (!user?.id || badgeIds.length === 0) return;
    const { data, error } = await supabase.from('user_badges').select('id, badge_id, name, icon, description').eq('user_id', user.id).in('badge_id', badgeIds);
    if (error) { console.warn('[BadgeCelebration] Failed to load awarded badges', error); return; }
    enqueue((data ?? []) as EarnedBadge[]);
  }, [enqueue, user?.id]);

  useEffect(() => {
    if (!user?.id) { readyUserId.current = null; seenBadgeIds.current.clear(); setQueue([]); setActiveBadge(null); return; }
    let active = true;
    readyUserId.current = null; seenBadgeIds.current.clear(); setQueue([]); setActiveBadge(null);
    void supabase.from('user_badges').select('id, badge_id').eq('user_id', user.id).then(({ data, error }) => {
      if (!active || error) return;
      (data ?? []).forEach((badge) => seenBadgeIds.current.add(String(badge.id || badge.badge_id)));
      readyUserId.current = user.id;
    });
    const channel = supabase.channel(`badge-celebration:${user.id}:${Date.now()}`).on('postgres_changes', {
      event: 'INSERT', schema: 'public', table: 'user_badges', filter: `user_id=eq.${user.id}`,
    }, (payload) => { if (readyUserId.current === user.id) enqueue([payload.new as EarnedBadge]); }).subscribe();
    return () => { active = false; void supabase.removeChannel(channel); };
  }, [enqueue, user?.id]);

  useEffect(() => {
    if (activeBadge || queue.length === 0) return;
    const [next, ...rest] = queue; setQueue(rest); setActiveBadge(next);
    const timeout = setTimeout(() => setActiveBadge(null), 5000);
    return () => clearTimeout(timeout);
  }, [activeBadge, queue]);

  const celebrateDigestCompletion = useCallback(() => setDigestCelebrationRun((run) => run + 1), []);
  const value = useMemo(() => ({ announceAwardedBadgeIds, celebrateDigestCompletion }), [announceAwardedBadgeIds, celebrateDigestCompletion]);
  return <BadgeCelebrationContext.Provider value={value}>{children}<GoalConfetti run={digestCelebrationRun} /><CelebrationOverlay badge={activeBadge} /></BadgeCelebrationContext.Provider>;
}

export function useBadgeCelebration() {
  const context = useContext(BadgeCelebrationContext);
  if (!context) throw new Error('useBadgeCelebration must be used inside BadgeCelebrationProvider');
  return context;
}

const s = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, zIndex: 999, elevation: 999 }, goalLayer: { ...StyleSheet.absoluteFillObject, zIndex: 24, elevation: 24 }, confettiLayer: { ...StyleSheet.absoluteFillObject }, particle: { position: 'absolute', borderRadius: 2 },
  banner: { position: 'absolute', top: 62, left: 18, right: 18, minHeight: 82, borderRadius: 22, padding: 13, flexDirection: 'row', alignItems: 'center', gap: 11, backgroundColor: '#FFFDF8', borderWidth: 1, borderColor: '#C7DDB8', shadowColor: '#2F5131', shadowOffset: { width: 0, height: 14 }, shadowOpacity: 0.22, shadowRadius: 22, elevation: 14 },
  iconCircle: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center', backgroundColor: '#E9F3DF' }, icon: { fontSize: 24 }, copy: { flex: 1, gap: 2 }, eyebrow: { color: '#6B9456', fontSize: 10, fontWeight: '900', letterSpacing: 1.25 }, name: { color: '#28251F', fontSize: 16, fontWeight: '800' }, description: { color: '#766E64', fontSize: 12 },
});
