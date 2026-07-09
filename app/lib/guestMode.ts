const GUEST_MODE_STORAGE_KEY = 'praxis.guestMode.v1';

const getStorage = (): Storage | null => {
  if (typeof window === 'undefined') return null;

  try {
    if (window.localStorage) return window.localStorage;
  } catch (error) {
    console.warn('[guestMode] localStorage unavailable', error);
  }

  try {
    if (window.sessionStorage) return window.sessionStorage;
  } catch (error) {
    console.warn('[guestMode] sessionStorage unavailable', error);
  }

  return null;
};

export const readGuestMode = (): boolean => {
  const storage = getStorage();
  if (!storage) return false;

  try {
    return storage.getItem(GUEST_MODE_STORAGE_KEY) === 'true';
  } catch (error) {
    console.warn('[guestMode] Failed to read guest mode', error);
    return false;
  }
};

export const writeGuestMode = (enabled: boolean) => {
  const storage = getStorage();
  if (!storage) return;

  try {
    if (enabled) {
      storage.setItem(GUEST_MODE_STORAGE_KEY, 'true');
      return;
    }

    storage.removeItem(GUEST_MODE_STORAGE_KEY);
  } catch (error) {
    console.warn('[guestMode] Failed to persist guest mode', error);
  }
};
