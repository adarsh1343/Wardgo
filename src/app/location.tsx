import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, View } from 'react-native';
import { AppText } from '../components/AppText';
import { Button } from '../components/Button';
import { Banner } from '../components/Feedback';
import { SearchField } from '../components/Field';
import { PixelIcon } from '../components/pixel/PixelArt';
import { Screen, SectionTitle } from '../components/Screen';
import { Sticker } from '../components/Sticker';
import { useApp } from '../features/app/AppState';
import { getDeviceLocation } from '../services/location/location';
import { type PlaceResult, searchPlaces } from '../services/weather/openMeteo';
import { useTheme } from '../theme/ThemeProvider';
import { borders } from '../theme/tokens';

export default function LocationScreen() {
  const { colors } = useTheme();
  const { prefs, updatePrefs } = useApp();
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<PlaceResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [locating, setLocating] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  // Debounced city search via Open-Meteo geocoding (free, no key).
  const searchable = query.trim().length >= 2;
  useEffect(() => {
    if (!searchable) return;
    let alive = true;
    const t = setTimeout(async () => {
      setSearching(true);
      try {
        const r = await searchPlaces(query);
        if (alive) setResults(r);
      } catch {
        if (alive) setMessage('City search needs an internet connection.');
      } finally {
        if (alive) setSearching(false);
      }
    }, 400);
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [query, searchable]);

  const useDevice = async () => {
    setLocating(true);
    setMessage(null);
    const res = await getDeviceLocation();
    setLocating(false);
    if (!res.ok) {
      setMessage(res.message);
      return;
    }
    await updatePrefs({ location: { mode: 'device', name: res.name, latitude: res.latitude, longitude: res.longitude } });
    router.back();
  };

  const choose = async (p: PlaceResult) => {
    await updatePrefs({ location: { mode: 'manual', name: p.detail ? `${p.name}, ${p.detail.split(', ').pop()}` : p.name, latitude: p.latitude, longitude: p.longitude } });
    router.back();
  };

  return (
    <Screen topInset={false}>
      {message ? <Banner text={message} tone="warn" onDismiss={() => setMessage(null)} /> : null}
      <Sticker tone="sky" style={{ gap: 10 }}>
        <SectionTitle title="Use my location" />
        <AppText variant="small" muted>
          Asks for “While Using” permission once. Your position is rounded to about 1 km before it is sent to Open-Meteo, and nothing else is shared.
        </AppText>
        <Button label="Use current location" icon="pin" onPress={useDevice} loading={locating} />
      </Sticker>

      <SectionTitle title="Or search for a city" />
      <SearchField value={query} onChangeText={setQuery} placeholder="City name" label="Search for a city" autoCorrect={false} />
      {searching ? <ActivityIndicator /> : null}
      {(searchable ? results : []).map((r) => (
        <Pressable
          key={r.id}
          onPress={() => choose(r)}
          accessibilityRole="button"
          accessibilityLabel={`${r.name}, ${r.detail}`}
          style={({ pressed }) => ({
            flexDirection: 'row',
            alignItems: 'center',
            gap: 12,
            padding: 12,
            minHeight: 52,
            borderWidth: borders.thin,
            borderColor: colors.border,
            backgroundColor: pressed ? colors.surfaceAlt : colors.surface,
          })}
        >
          <PixelIcon name="pin" size={12} color={colors.primary} />
          <View style={{ flex: 1 }}>
            <AppText variant="bodyStrong">{r.name}</AppText>
            <AppText variant="small" muted>
              {r.detail}
            </AppText>
          </View>
        </Pressable>
      ))}

      {prefs.location.mode !== 'none' ? (
        <Button
          label="Turn off weather"
          variant="ghost"
          onPress={async () => {
            await updatePrefs({ location: { mode: 'none' } });
            router.back();
          }}
          accessibilityHint="Outfits will use seasonal defaults"
        />
      ) : null}
    </Screen>
  );
}
