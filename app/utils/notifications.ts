import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { supabase } from '../services/supabase';

// Configure how notifications appear when the app is in the foreground
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

export async function registerPushToken(userId: string): Promise<void> {
  try {
    const { status: existing } = await Notifications.getPermissionsAsync();
    let finalStatus = existing;

    if (existing !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') return;

    const { data: token } = await Notifications.getExpoPushTokenAsync();
    if (!token) return;

    const platform = Platform.OS === 'ios' ? 'ios' : 'android';
    await supabase.from('push_tokens').upsert(
      { user_id: userId, token, platform },
      { onConflict: 'user_id,token' }
    );
  } catch {
    // Non-fatal — push is a best-effort feature
  }
}

export async function unregisterPushToken(userId: string): Promise<void> {
  try {
    const { data } = await Notifications.getExpoPushTokenAsync();
    if (!data) return;
    await supabase.from('push_tokens').delete()
      .eq('user_id', userId)
      .eq('token', data);
  } catch {
    // Non-fatal
  }
}
