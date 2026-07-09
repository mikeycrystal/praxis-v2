import fetchPolyfill, {
  Headers as FetchHeaders,
  Request as FetchRequest,
  Response as FetchResponse,
} from 'cross-fetch';

const createMemoryStorage = (): Storage => {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.has(key) ? store.get(key)! : null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, String(value));
    },
  };
};

const ensureStorage = (storageKey: 'localStorage' | 'sessionStorage') => {
  if (typeof window === 'undefined') return;

  try {
    if (window[storageKey]) return;
  } catch (error) {
    // Fall through to define a lightweight memory-backed storage shim.
  }

  try {
    Object.defineProperty(window, storageKey, {
      configurable: true,
      enumerable: true,
      value: createMemoryStorage(),
      writable: false,
    });
  } catch (error) {
    console.warn(`[webRuntimePolyfills] Failed to define ${storageKey}`, error);
  }
};

if (typeof window !== 'undefined') {
  if (typeof globalThis.fetch !== 'function') {
    (globalThis as typeof globalThis & { fetch: typeof fetch }).fetch = fetchPolyfill as typeof fetch;
  }

  if (typeof globalThis.Headers === 'undefined') {
    (globalThis as typeof globalThis & { Headers: typeof Headers }).Headers = FetchHeaders as typeof Headers;
  }

  if (typeof globalThis.Request === 'undefined') {
    (globalThis as typeof globalThis & { Request: typeof Request }).Request = FetchRequest as typeof Request;
  }

  if (typeof globalThis.Response === 'undefined') {
    (globalThis as typeof globalThis & { Response: typeof Response }).Response = FetchResponse as typeof Response;
  }

  ensureStorage('localStorage');
  ensureStorage('sessionStorage');
}
