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

function deviceTimezone(): string | null {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone ?? null;
  } catch {
    return null;
  }
}

async function storeToken(userId: string): Promise<void> {
  const { data: token } = await Notifications.getExpoPushTokenAsync();
  if (!token) return;

  const platform = Platform.OS === 'ios' ? 'ios' : 'android';
  await supabase.from('push_tokens').upsert(
    {
      user_id: userId,
      token,
      platform,
      timezone: deviceTimezone(),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id,token' }
  );
}

// Silent: stores a token (with the device timezone) only when permission is
// already granted. Never shows the system dialog — that is askPushPermission's
// job, and it only runs from the in-app card after the first completed digest.
export async function registerPushToken(userId: string): Promise<void> {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    if (status !== 'granted') return;
    await storeToken(userId);
  } catch {
    // Non-fatal — push is a best-effort feature
  }
}

// Explicit: triggers the system permission dialog. Call only after the user
// tapped "Yes, remind me" on the in-app card. Returns whether we got it.
export async function askPushPermission(userId: string): Promise<boolean> {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    if (status !== 'granted') return false;
    await storeToken(userId);
    return true;
  } catch {
    return false;
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
