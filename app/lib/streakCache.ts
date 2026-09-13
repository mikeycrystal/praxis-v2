import AsyncStorage from '@react-native-async-storage/async-storage';

// Last server-confirmed streak, so the pill can show a real number instead
// of a dash while the profile loads. Display-only — never used for logic.

const STORAGE_KEY = 'praxis.lastKnownStreak.v1';

export async function readCachedStreak(): Promise<number | null> {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    if (raw == null) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
  } catch {
    return null;
  }
}

export async function writeCachedStreak(value: number | null | undefined): Promise<void> {
  try {
    if (value == null) return;
    await AsyncStorage.setItem(STORAGE_KEY, String(value));
  } catch {
    // Non-fatal — display convenience only
  }
}
