import * as Clipboard from 'expo-clipboard';
import { Alert, Linking, Platform, Share } from 'react-native';

export interface ShareableArticle {
  id: string | number;
  title: string;
  lede?: string | null;
  url?: string | null;
  imageUrl?: string | null;
  publisher?: { name?: string | null } | null;
}

const PRAXIS_WEB_URL = 'https://www.praxismedia.us';

export const buildPraxisStoryUrl = (articleId: ShareableArticle['id']) =>
  `${PRAXIS_WEB_URL}/story/${encodeURIComponent(String(articleId))}`;

export const buildPraxisAppUrl = (articleId: ShareableArticle['id']) =>
  `praxis://article/${encodeURIComponent(String(articleId))}`;

export const buildPraxisShareText = (article: ShareableArticle) => {
  const publisher = article.publisher?.name?.trim();
  const byline = publisher ? `Shared from Praxis via ${publisher}` : 'Shared from Praxis';

  // Social apps unfurl the HTTPS URL into Praxis's server-rendered card.
  // The custom URL takes installed-app recipients to the same article.
  return [
    article.title.trim(),
    article.lede?.trim() || null,
    byline,
    `Open in Praxis: ${buildPraxisAppUrl(article.id)}`,
    buildPraxisStoryUrl(article.id),
  ].filter((value): value is string => Boolean(value)).join('\n\n');
};

export const copyPraxisStoryLink = async (article: ShareableArticle) => {
  await Clipboard.setStringAsync(buildPraxisStoryUrl(article.id));
};

export const sharePraxisStory = async (article: ShareableArticle) => {
  const storyUrl = buildPraxisStoryUrl(article.id);
  try {
    await Share.share({ title: article.title, message: buildPraxisShareText(article), url: storyUrl });
  } catch (error) {
    console.warn('[shareArticle] Share failed', error);
    Alert.alert('Share unavailable', 'We could not open the share sheet for this story right now.');
  }
};

export const openPraxisStoryMessage = async (article: ShareableArticle) => {
  const body = encodeURIComponent(buildPraxisShareText(article));
  const smsUrl = Platform.OS === 'ios' ? `sms:&body=${body}` : `sms:?body=${body}`;
  try {
    await Linking.openURL(smsUrl);
  } catch (error) {
    console.warn('[shareArticle] Messages failed to open', error);
    Alert.alert('Messages unavailable', 'We could not open Messages for this story right now.');
  }
};

export const shareArticle = sharePraxisStory;
