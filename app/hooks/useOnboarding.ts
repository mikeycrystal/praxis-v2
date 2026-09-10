import { useCallback, useEffect, useRef, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';

// Port of the web app's useOnboarding (card-page/src/hooks/useOnboarding.ts).
// Five flags drive the guided tour: the swipe tooltip on the feed, the banner
// pointing at the Graph tab, and the two-step spotlight on the Graph page.
// Signed-in users keep the flags on profiles (shared with web); guests keep
// them on the device; a login merges the two with OR.
export interface OnboardingState {
  onboarding_swipe_completed: boolean;
  onboarding_graph_banner_completed: boolean;
  onboarding_graph_visited: boolean;
  onboarding_graph_substep1_completed: boolean;
  onboarding_graph_substep2_completed: boolean;
}

export const ONBOARDING_KEYS = [
  'onboarding_swipe_completed',
  'onboarding_graph_banner_completed',
  'onboarding_graph_visited',
  'onboarding_graph_substep1_completed',
  'onboarding_graph_substep2_completed',
] as const;

const INITIAL_STATE: OnboardingState = {
  onboarding_swipe_completed: false,
  onboarding_graph_banner_completed: false,
  onboarding_graph_visited: false,
  onboarding_graph_substep1_completed: false,
  onboarding_graph_substep2_completed: false,
};

const STORAGE_KEY = 'praxis.onboarding.v1';
const SELECT = ONBOARDING_KEYS.join(', ');

const readLocal = async (): Promise<OnboardingState> => {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...INITIAL_STATE };
    const parsed = JSON.parse(raw) as Partial<OnboardingState>;
    const state = { ...INITIAL_STATE };
    ONBOARDING_KEYS.forEach((key) => {
      if (typeof parsed[key] === 'boolean') state[key] = parsed[key] as boolean;
    });
    return state;
  } catch (error) {
    console.warn('[useOnboarding] Failed to read local state', error);
    return { ...INITIAL_STATE };
  }
};

const writeLocal = async (state: OnboardingState) => {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch (error) {
    console.warn('[useOnboarding] Failed to write local state', error);
  }
};

const readRemote = async (userId: string): Promise<OnboardingState | null> => {
  try {
    const { data, error } = await supabase
      .from('profiles')
      .select(SELECT)
      .eq('id', userId)
      .single();
    if (error || !data) return null;
    const state = { ...INITIAL_STATE };
    ONBOARDING_KEYS.forEach((key) => {
      const value = (data as unknown as Record<string, unknown>)[key];
      if (typeof value === 'boolean') state[key] = value;
    });
    return state;
  } catch (error) {
    console.warn('[useOnboarding] Failed to read remote state', error);
    return null;
  }
};

const writeRemote = async (userId: string, state: OnboardingState) => {
  try {
    const { error } = await supabase.from('profiles').update({ ...state }).eq('id', userId);
    if (error) console.warn('[useOnboarding] Failed to write remote state', error);
  } catch (error) {
    console.warn('[useOnboarding] Failed to write remote state', error);
  }
};

const mergeStates = (a: OnboardingState, b: OnboardingState): OnboardingState => {
  const merged = { ...INITIAL_STATE };
  ONBOARDING_KEYS.forEach((key) => {
    merged[key] = a[key] || b[key];
  });
  return merged;
};

export const useOnboarding = (session: Session | null) => {
  const [onboardingState, setOnboardingState] = useState<OnboardingState>(INITIAL_STATE);
  const [isLoading, setIsLoading] = useState(true);
  const stateRef = useRef(onboardingState);
  stateRef.current = onboardingState;
  const userId = session?.user?.id ?? null;

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    (async () => {
      const local = await readLocal();
      let next = local;
      if (userId) {
        const remote = await readRemote(userId);
        if (remote) {
          // A login carries over anything the guest already saw.
          next = mergeStates(local, remote);
          if (ONBOARDING_KEYS.some((key) => next[key] !== remote[key])) {
            void writeRemote(userId, next);
          }
        }
      }
      if (cancelled) return;
      setOnboardingState(next);
      void writeLocal(next);
      setIsLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const syncState = useCallback(async (next: OnboardingState) => {
    setOnboardingState(next);
    stateRef.current = next;
    await writeLocal(next);
    if (userId) await writeRemote(userId, next);
  }, [userId]);

  const completeStep = useCallback(async (step: keyof OnboardingState) => {
    if (stateRef.current[step]) return;
    await syncState({ ...stateRef.current, [step]: true });
  }, [syncState]);

  const markGraphVisited = useCallback(async () => {
    await syncState({
      ...stateRef.current,
      onboarding_graph_visited: true,
      onboarding_graph_substep1_completed: true,
      onboarding_graph_substep2_completed: true,
    });
  }, [syncState]);

  const shouldShowSwipeTooltip = !isLoading && !onboardingState.onboarding_swipe_completed;
  const shouldShowGraphBanner =
    !isLoading &&
    onboardingState.onboarding_swipe_completed &&
    !onboardingState.onboarding_graph_banner_completed &&
    !onboardingState.onboarding_graph_visited;
  const shouldShowGraphOnboarding = !isLoading && !onboardingState.onboarding_graph_visited;

  return {
    isLoading,
    onboardingState,
    shouldShowSwipeTooltip,
    shouldShowGraphBanner,
    shouldShowGraphOnboarding,
    completeStep,
    markGraphVisited,
  };
};
