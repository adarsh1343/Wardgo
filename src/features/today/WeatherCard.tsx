import { router } from 'expo-router';
import { View } from 'react-native';
import { AppText } from '../../components/AppText';
import { Button, IconButton } from '../../components/Button';
import { PixelTag } from '../../components/Chip';
import { Disc, Zigzag } from '../../components/memphis/Shapes';
import { PixelIcon, WeatherSprite } from '../../components/pixel/PixelArt';
import { Sticker } from '../../components/Sticker';
import { describeWeatherCode, formatTemp } from '../../engine/weather';
import { useTheme } from '../../theme/ThemeProvider';
import type { WeatherSnapshot } from '../../types/models';
import { formatTime, relativeAge } from '../../utils/date';

interface WeatherCardProps {
  snapshot: WeatherSnapshot | null;
  stale: boolean;
  error: string | null;
  loading: boolean;
  units: 'C' | 'F';
  hasLocation: boolean;
  onRefresh: () => void;
}

export function WeatherCard({ snapshot, stale, error, loading, units, hasLocation, onRefresh }: WeatherCardProps) {
  const { colors } = useTheme();

  if (!hasLocation) {
    return (
      <Sticker tone="sky" shape="ticketAlt" style={{ gap: 10 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <WeatherSprite kind="partly" size={48} />
          <View style={{ flex: 1 }}>
            <AppText variant="heading">Add a location for weather</AppText>
            <AppText variant="small" muted>
              Outfits use seasonal defaults until then. Only an approximate location is ever sent to the weather service.
            </AppText>
          </View>
        </View>
        <Button label="Set location" icon="pin" size="sm" variant="ghost" onPress={() => router.push('/location')} style={{ alignSelf: 'flex-start' }} />
      </Sticker>
    );
  }

  if (!snapshot) {
    return (
      <Sticker tone="sky" shape="ticketAlt" style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
        <WeatherSprite kind="cloudy" size={48} />
        <View style={{ flex: 1, gap: 4 }}>
          <AppText variant="heading">{loading ? 'Checking the sky…' : 'Weather unavailable'}</AppText>
          <AppText variant="small" muted>
            {loading ? 'Fetching today’s forecast.' : (error ?? 'Outfits use seasonal defaults for now.')}
          </AppText>
        </View>
        <IconButton icon="refresh" onPress={onRefresh} accessibilityLabel="Retry weather" disabled={loading} />
      </Sticker>
    );
  }

  const { icon } = describeWeatherCode(snapshot.code, snapshot.isDay);
  const t = (c: number) => formatTemp(c, units);
  const a11ySummary = `${snapshot.summary}, ${t(snapshot.tempC)}${units}, feels like ${t(snapshot.feelsLikeC)}. High ${t(snapshot.highC)}, low ${t(snapshot.lowC)}.${
    snapshot.precipProbability !== null ? ` ${snapshot.precipProbability} percent chance of rain.` : ''
  }`;

  return (
    <Sticker tone="sky" shape="ticketAlt" style={{ gap: 12, overflow: 'hidden' }}>
      {/* Memphis accent sits behind the sprite, away from the numbers. */}
      <View style={{ position: 'absolute', left: -14, top: -14 }} pointerEvents="none">
        <Disc size={96} color={colors.surface} />
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }} accessible accessibilityLabel={a11ySummary}>
        <WeatherSprite kind={icon} size={64} />
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
            <AppText variant="display" style={{ fontSize: 44, lineHeight: 48 }}>
              {t(snapshot.tempC)}
            </AppText>
            <AppText variant="bodyStrong" style={{ marginBottom: 7 }}>
              {units}
            </AppText>
          </View>
          <AppText variant="bodyStrong">{snapshot.summary}</AppText>
          <AppText variant="small" muted numberOfLines={1}>
            {snapshot.locationName}
          </AppText>
        </View>
        <IconButton icon="refresh" onPress={onRefresh} accessibilityLabel="Refresh weather" disabled={loading} />
      </View>

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        <Stat icon="thermo" label={`Feels ${t(snapshot.feelsLikeC)}`} />
        <Stat icon="sun" label={`H ${t(snapshot.highC)} · L ${t(snapshot.lowC)}`} />
        {snapshot.precipProbability !== null ? <Stat icon="drop" label={`${snapshot.precipProbability}% rain`} /> : null}
        {snapshot.windKph !== null ? <Stat icon="wind" label={`${Math.round(units === 'F' ? snapshot.windKph * 0.621 : snapshot.windKph)} ${units === 'F' ? 'mph' : 'km/h'}`} /> : null}
      </View>

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
          {stale ? <PixelTag label="Stale" tone="highlight" /> : <PixelTag label="Live" tone="mint" />}
          <AppText variant="caption" muted>
            Updated {formatTime(snapshot.fetchedAt)} ({relativeAge(snapshot.fetchedAt)})
          </AppText>
        </View>
        <AppText variant="caption" muted>
          Weather: Open-Meteo.com
        </AppText>
      </View>
      {error ? (
        <AppText variant="caption" color={colors.text}>
          {error}
        </AppText>
      ) : null}
      <View style={{ position: 'absolute', right: 10, bottom: -4 }} pointerEvents="none">
        <Zigzag width={40} color={colors.primary} strokeWidth={3} height={10} />
      </View>
    </Sticker>
  );
}

function Stat({ icon, label }: { icon: 'thermo' | 'sun' | 'drop' | 'wind'; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: colors.surface, borderWidth: 1.5, borderColor: colors.border, borderRadius: 999, paddingHorizontal: 10, paddingVertical: 4 }}>
      <PixelIcon name={icon} size={12} color={colors.text} />
      <AppText variant="caption">{label}</AppText>
    </View>
  );
}
