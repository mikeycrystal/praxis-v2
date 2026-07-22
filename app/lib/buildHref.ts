import type { Href } from 'expo-router';

type AppPath =
  | '/'
  | '/forgot-password'
  | '/graph'
  | '/login'
  | '/onboarding'
  | '/profile'
  | '/register'
  | '/social';

export function buildHref(
  pathname: AppPath,
  params?: Record<string, string | number | boolean | null | undefined>,
): Href {
  return params ? { pathname, params } as Href : pathname;
}
