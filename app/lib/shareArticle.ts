import { Alert, Platform, Share } from 'react-native';

interface ShareableArticle {
  title: string;
  lede?: string | null;
  url?: string | null;
  publisher?: {
    name?: string | null;
  } | null;
}

const PREVIEW_URL_FRAGMENT = 'example.com/praxis-preview/';

const isPreviewOnlyUrl = (value?: string | null) =>
  typeof value === 'string' && value.includes(PREVIEW_URL_FRAGMENT);

const buildShareText = (article: ShareableArticle) => {
  const publisherName = article.publisher?.name?.trim();
  const trimmedTitle = article.title.trim();
  const trimmedLede = article.lede?.trim();
  const usableUrl = article.url && !isPreviewOnlyUrl(article.url) ? article.url : null;

  const lines = [
    trimmedTitle,
    trimmedLede || null,
    usableUrl,
  ].filter((value): value is string => Boolean(value));

  if (lines.length > 0) {
    return lines.join('\n\n');
  }

  return publisherName
    ? `Shared from Praxis: ${publisherName}`
    : 'Shared from Praxis';
};

const getFallbackNotice = (article: ShareableArticle) => {
  if (article.url && !isPreviewOnlyUrl(article.url)) {
    return 'The share sheet could not open, but the story details were copied to your clipboard.';
  }

  return 'This preview story does not have a live article URL yet, so we shared the headline and summary only.';
};

export const shareArticle = async (article: ShareableArticle) => {
  const shareText = buildShareText(article);
  const liveUrl = article.url && !isPreviewOnlyUrl(article.url) ? article.url : undefined;

  try {
    await Share.share({
      title: article.title,
      message: shareText,
      url: liveUrl,
    });

    if (article.url && isPreviewOnlyUrl(article.url)) {
      Alert.alert(
        'Preview share',
        'This safe-mode story is using preview data, so the share only includes the headline and summary.',
      );
    }
  } catch (error) {
    if (
      Platform.OS === 'web' &&
      typeof window !== 'undefined' &&
      window.navigator?.clipboard?.writeText
    ) {
      try {
        await window.navigator.clipboard.writeText(shareText);
        Alert.alert('Copied to clipboard', getFallbackNotice(article));
        return;
      } catch (clipboardError) {
        console.warn('[shareArticle] Clipboard fallback failed', clipboardError);
      }
    }

    console.warn('[shareArticle] Share failed', error);
    Alert.alert(
      'Share unavailable',
      article.url && !isPreviewOnlyUrl(article.url)
        ? 'We could not open the share sheet for this story right now.'
        : 'We could not open the share sheet for this preview story right now.',
    );
  }
};
