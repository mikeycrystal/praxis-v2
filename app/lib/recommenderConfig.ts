export interface RecommenderConfig {
  apiBaseUrl: string | null;
  apiKey: string | null;
  isEnabled: boolean;
}

const normalizeEnvValue = (value: string | undefined): string | null => {
  if (!value) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
};

export const getRecommenderConfig = (): RecommenderConfig => {
  const apiBaseUrl = normalizeEnvValue(process.env.EXPO_PUBLIC_RECOMMENDER_API_URL);
  const apiKey = normalizeEnvValue(process.env.EXPO_PUBLIC_RECOMMENDER_API_KEY);
  const disableLiveRecommender =
    normalizeEnvValue(process.env.EXPO_PUBLIC_DISABLE_LIVE_RECOMMENDER) === 'true';

  return {
    apiBaseUrl,
    apiKey,
    isEnabled: Boolean(apiBaseUrl) && !disableLiveRecommender,
  };
};

export const getRecommenderHeaders = (): Record<string, string> => {
  const { apiKey } = getRecommenderConfig();
  return apiKey ? { 'X-API-Key': apiKey } : {};
};
