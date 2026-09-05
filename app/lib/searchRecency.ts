// Recency window for Graph free-text search. Remembered for the session so
// the second search is one tap; null means no limit.
export type RecencyDays = 7 | 14 | 30 | null;

export const RECENCY_OPTIONS: { value: RecencyDays; label: string }[] = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 30, label: '30 days' },
  { value: null, label: 'All time' },
];

export const DEFAULT_RECENCY_DAYS: RecencyDays = 14;

let rememberedRecencyDays: RecencyDays = DEFAULT_RECENCY_DAYS;

export const readSearchRecencyDays = (): RecencyDays => rememberedRecencyDays;

export const writeSearchRecencyDays = (value: RecencyDays) => {
  rememberedRecencyDays = value;
};

export const isWithinRecencyWindow = (tsPub: string | null | undefined, days: RecencyDays) => {
  if (days === null) return true;
  if (!tsPub) return true;
  const published = new Date(tsPub).getTime();
  if (!Number.isFinite(published)) return true;
  return published >= Date.now() - days * 24 * 60 * 60 * 1000;
};
