// Optional daily local reminder. This schedules a notification with iOS; it
// does NOT run app code in the background, so it cannot fetch weather at that
// time. The weather is refreshed when the user opens the app from the reminder.
import * as Notifications from 'expo-notifications';

const REMINDER_ID = 'wardgo-morning-reminder';

export function configureNotificationHandler(): void {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldShowBanner: true,
      shouldShowList: true,
      shouldPlaySound: false,
      shouldSetBadge: false,
    }),
  });
}

export async function ensurePermission(): Promise<boolean> {
  const existing = await Notifications.getPermissionsAsync();
  if (existing.granted) return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.granted;
}

export async function scheduleMorningReminder(hour: number, minute: number): Promise<{ ok: boolean; message?: string }> {
  const granted = await ensurePermission();
  if (!granted) {
    return { ok: false, message: 'Notifications are turned off for this app. Enable them in iOS Settings to get reminders.' };
  }
  await cancelMorningReminder();
  await Notifications.scheduleNotificationAsync({
    identifier: REMINDER_ID,
    content: {
      title: "Today's fit is ready",
      body: 'Open Wardgo for the weather and an outfit idea.',
      data: { url: '/' },
    },
    trigger: { type: Notifications.SchedulableTriggerInputTypes.DAILY, hour, minute },
  });
  return { ok: true };
}

export async function cancelMorningReminder(): Promise<void> {
  try {
    await Notifications.cancelScheduledNotificationAsync(REMINDER_ID);
  } catch {
    // Nothing scheduled.
  }
}
