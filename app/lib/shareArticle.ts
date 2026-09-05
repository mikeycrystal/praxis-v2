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

// Install link for the "Download the Praxis app" line. No public App Store
// listing yet, so this points at the website; replace with the store URL
// once the app is listed.
const PRAXIS_APP_DOWNLOAD_URL = PRAXIS_WEB_URL;

export const buildPraxisStoryUrl = (articleId: ShareableArticle['id']) =>
  `${PRAXIS_WEB_URL}/story/${encodeURIComponent(String(articleId))}`;

export const buildPraxisAppUrl = (articleId: ShareableArticle['id']) =>
  `praxis://article/${encodeURIComponent(String(articleId))}`;

// Mirrors the web share: headline, then the story link. The story link comes
// first so messaging apps unfurl the Praxis card rather than the download
// link. The https link opens the app when installed (universal link) and the
// web deck otherwise, so no custom-scheme URL is included.
export const buildPraxisShareText = (article: ShareableArticle) =>
  [
    article.title.trim(),
    buildPraxisStoryUrl(article.id),
    PRAXIS_APP_DOWNLOAD_URL ? `Download the Praxis app: ${PRAXIS_APP_DOWNLOAD_URL}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join('\n\n');

export const copyPraxisStoryLink = async (article: ShareableArticle) => {
  await Clipboard.setStringAsync(buildPraxisStoryUrl(article.id));
};

export const sharePraxisStory = async (article: ShareableArticle) => {
  try {
    // Message only: passing `url` as well makes iOS targets like Messages
    // append the link a second time.
    await Share.share({ title: article.title, message: buildPraxisShareText(article) });
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
