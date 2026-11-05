// Import single weights (not the package root) so only these font files are bundled.
import { ArchivoBlack_400Regular } from '@expo-google-fonts/archivo-black/400Regular';
import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_700Bold } from '@expo-google-fonts/dm-sans/700Bold';
import { Silkscreen_400Regular } from '@expo-google-fonts/silkscreen/400Regular';
import { useFonts } from 'expo-font';
import * as Notifications from 'expo-notifications';
import { router, SplashScreen, Stack } from 'expo-router';
import { type SQLiteDatabase, SQLiteProvider } from 'expo-sqlite';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AppText } from '../components/AppText';
import { adaptExpoDb, DATABASE_NAME } from '../database/db';
import { migrate } from '../database/migrations';
import { AppStateProvider, useApp } from '../features/app/AppState';
import { configureNotificationHandler } from '../services/notifications/reminders';
import { cleanupOrphanImages } from '../services/storage/images';
import { ThemeProvider, useTheme } from '../theme/ThemeProvider';
import { fonts, lightColors } from '../theme/tokens';

SplashScreen.preventAutoHideAsync().catch(() => undefined);
configureNotificationHandler();

// Must be a stable reference: SQLiteProvider re-initialises if it changes.
async function initDatabase(db: SQLiteDatabase) {
  await db.execAsync('PRAGMA journal_mode = WAL;');
  const adapted = adaptExpoDb(db);
  await migrate(adapted);
  // Remove photos left behind by interrupted imports (older than 1 hour).
  cleanupOrphanImages(adapted).catch(() => undefined);
}

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    ArchivoBlack_400Regular,
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_700Bold,
    Silkscreen_400Regular,
  });
  const [dbError, setDbError] = useState<Error | null>(null);

  // Fonts that fail to load fall back to the system font; the app still runs.
  const ready = fontsLoaded || !!fontError;
  useEffect(() => {
    if (ready) SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);
  if (!ready) return null;

  if (dbError) return <DatabaseErrorScreen error={dbError} />;

  return (
    <SafeAreaProvider>
      <SQLiteProvider databaseName={DATABASE_NAME} onInit={initDatabase} onError={setDbError}>
        <AppStateProvider>
          <ThemedRoot />
        </AppStateProvider>
      </SQLiteProvider>
    </SafeAreaProvider>
  );
}

function ThemedRoot() {
  const { prefs, prefsLoaded } = useApp();
  if (!prefsLoaded) return null;
  return (
    <ThemeProvider mode={prefs.themeMode}>
      <Navigation />
    </ThemeProvider>
  );
}

/** Opens the Today screen when the morning reminder is tapped. */
function useNotificationRouting() {
  useEffect(() => {
    const open = (n: Notifications.Notification) => {
      const url = n.request.content.data?.url;
      if (typeof url === 'string') {
        router.navigate('/');
        Notifications.clearLastNotificationResponse();
      }
    };
    const last = Notifications.getLastNotificationResponse();
    if (last?.notification) open(last.notification);
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification));
    return () => sub.remove();
  }, []);
}

function Navigation() {
  const { colors, dark, reduceMotion } = useTheme();
  useNotificationRouting();
  return (
    <>
      <StatusBar style={dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.text,
          headerTitleStyle: { fontFamily: fonts.bodyBold, color: colors.text },
          headerShadowVisible: false,
          headerBackButtonDisplayMode: 'minimal',
          contentStyle: { backgroundColor: colors.bg },
          animation: reduceMotion ? 'fade' : 'default',
        }}
      >
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="item/new" options={{ title: 'New piece', presentation: 'modal' }} />
        <Stack.Screen name="item/[id]" options={{ title: '' }} />
        <Stack.Screen name="item/edit/[id]" options={{ title: 'Edit piece', presentation: 'modal' }} />
        <Stack.Screen name="outfit/[id]" options={{ title: '' }} />
        <Stack.Screen name="album/[id]" options={{ title: '' }} />
        <Stack.Screen name="location" options={{ title: 'Weather location', presentation: 'modal' }} />
        <Stack.Screen name="style-profile" options={{ title: 'Style profile' }} />
        <Stack.Screen name="history" options={{ title: 'History & feedback' }} />
      </Stack>
    </>
  );
}

function DatabaseErrorScreen({ error }: { error: Error }) {
  return (
    <View style={{ flex: 1, backgroundColor: lightColors.bg, paddingTop: 80 }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 12 }}>
        <AppText variant="title" color={lightColors.text}>
          Wardgo could not open its database
        </AppText>
        <AppText color={lightColors.text}>
          Your data has not been deleted. Try closing the app completely and opening it again. If this keeps happening,
          see “SQLite initialization fails” in the README troubleshooting section.
        </AppText>
        <AppText variant="small" color={lightColors.textMuted}>
          Details: {error.message}
        </AppText>
      </ScrollView>
    </View>
  );
}
