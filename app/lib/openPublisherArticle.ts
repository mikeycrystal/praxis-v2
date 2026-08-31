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
    dismissButtonStyle: 'close',
    // Page sheets can expand to full screen during dismissal on iPhone,
    // producing a visible flash before returning to Praxis.
    presentationStyle: WebBrowser.WebBrowserPresentationStyle.OVER_FULL_SCREEN,
    enableBarCollapsing: true,
    showTitle: true,
    enableDefaultShareMenuItem: true,
  });
};
