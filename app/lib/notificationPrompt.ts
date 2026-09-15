import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Ask-for-permission timing (notifications spec §4 + Ayuka 2026-09-15):
// signed-in users see the card after their 1st completed digest, again after
// the 3rd if declined, then never. GUESTS are staggered one win later (2nd,
// then 4th) because their first completion already carries the account
// prompt — never two cards on one celebration. The system dialog fires only
// from a "Yes" on the card.

const STORAGE_KEY = 'praxis.notificationPrompt.v1';

interface PromptState {
  completions: number;
  declines: number;
  done: boolean; // granted, or asked twice — never show again
}

const DEFAULT_STATE: PromptState = { completions: 0, declines: 0, done: false };

async function readState(): Promise<PromptState> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (!raw) return { ...DEFAULT_STATE };
    const parsed = JSON.parse(raw) as Partial<PromptState>;
    return {
      completions: typeof parsed.completions === 'number' ? parsed.completions : 0,
      declines: typeof parsed.declines === 'number' ? parsed.declines : 0,
      done: parsed.done === true,
    };
  } catch {
    return { ...DEFAULT_STATE };
  }
}

async function writeState(state: PromptState): Promise<void> {
  try {
    await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Non-fatal
  }
}

// Call on every digest completion. Resolves which ask to show (or null).
// 'value' = the news-angle first ask; 'streak' = the streak-angle second ask.
export type NotificationAsk = 'value' | 'streak';

export async function recordDigestCompletionForPrompt(
  isGuest = false,
): Promise<NotificationAsk | null> {
  if (Platform.OS === 'web') return null;

  const state = await readState();
  state.completions += 1;
  await writeState(state);

  if (state.done) return null;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await writeState({ ...state, done: true });
      return null;
    }
  } catch {
    return null;
  }

  const firstAt = isGuest ? 2 : 1;
  const secondAt = isGuest ? 4 : 3;
  if (state.declines === 0) return state.completions >= firstAt ? 'value' : null;
  if (state.declines === 1) return state.completions >= secondAt ? 'streak' : null;
  return null;
}

export async function recordPromptDeclined(): Promise<void> {
  const state = await readState();
  state.declines += 1;
  if (state.declines >= 2) state.done = true;
  await writeState(state);
}

export async function recordPromptGranted(): Promise<void> {
  const state = await readState();
  state.done = true;
  await writeState(state);
}
