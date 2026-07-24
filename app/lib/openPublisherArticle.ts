import { Linking, Platform } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

const BROWSER_COLORS = {
  toolbar: '#F7F3EA',
  controls: '#5F7F4D',
};

const getPublisherUrl = (url: string | null | undefined) => {
  const value = url?.trim();
  if (!value) {
    throw new Error('Missing publisher URL');
  }

  const parsed = new URL(value);
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new Error('Unsupported publisher URL');
  }

  return parsed.toString();
};

export const openPublisherArticle = async (
  url: string | null | undefined,
) => {
  const publisherUrl = getPublisherUrl(url);

  if (Platform.OS === 'web') {
    await Linking.openURL(publisherUrl);
    return;
  }

  await WebBrowser.openBrowserAsync(publisherUrl, {
    toolbarColor: BROWSER_COLORS.toolbar,
    secondaryToolbarColor: BROWSER_COLORS.toolbar,
    controlsColor: BROWSER_COLORS.controls,
    dismissButtonStyle: 'done',
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.PAGE_SHEET,
    enableBarCollapsing: true,
    showTitle: true,
    enableDefaultShareMenuItem: true,
  });
};
