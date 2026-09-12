import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

// Ask-for-permission timing (notifications spec §4): show the in-app card
// after the 1st completed digest; if declined, once more after the 3rd;
// then never again. The system dialog fires only from a "Yes" on the card.

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

// Call on every digest completion. Resolves true when the card should show.
export async function recordDigestCompletionForPrompt(): Promise<boolean> {
  if (Platform.OS === 'web') return false;

  const state = await readState();
  state.completions += 1;
  await writeState(state);

  if (state.done) return false;

  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status === 'granted') {
      await writeState({ ...state, done: true });
      return false;
    }
  } catch {
    return false;
  }

  if (state.declines === 0) return state.completions >= 1;
  if (state.declines === 1) return state.completions >= 3;
  return false;
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
