type AnalyticsCandidate = {
  id?: string | null;
  email?: string | null;
};

const parseCsv = (value: string | undefined) =>
  (value ?? '')
    .split(',')
    .map((entry) => entry.trim().toLowerCase())
    .filter(Boolean);

// This is intentionally a UI gate, not the data-access boundary. Supabase RLS
// must remain the authority for the analytics reporting views.
const ADMIN_EMAILS = parseCsv(process.env.EXPO_PUBLIC_ANALYTICS_ADMIN_EMAILS);
const ADMIN_USER_IDS = parseCsv(process.env.EXPO_PUBLIC_ANALYTICS_ADMIN_USER_IDS);

export const isAnalyticsAccessConfigured = () => ADMIN_EMAILS.length > 0 || ADMIN_USER_IDS.length > 0;

export const isAnalyticsAdmin = (candidate: AnalyticsCandidate | null | undefined) => {
  if (!candidate || !isAnalyticsAccessConfigured()) return false;

  const id = candidate.id?.trim().toLowerCase();
  const email = candidate.email?.trim().toLowerCase();

  return Boolean((id && ADMIN_USER_IDS.includes(id)) || (email && ADMIN_EMAILS.includes(email)));
};
