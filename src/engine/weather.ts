// Turns raw weather into the clothing-relevant facts the engine scores against.
import type { Season, WeatherContext } from '../types/models';

export type WeatherIconKind =
  | 'clear'
  | 'clear-night'
  | 'partly'
  | 'cloudy'
  | 'fog'
  | 'drizzle'
  | 'rain'
  | 'snow'
  | 'storm';

/** WMO weather interpretation codes, as used by Open-Meteo. */
export function describeWeatherCode(code: number, isDay = true): { summary: string; icon: WeatherIconKind } {
  if (code === 0) return { summary: 'Clear sky', icon: isDay ? 'clear' : 'clear-night' };
  if (code === 1) return { summary: 'Mostly clear', icon: isDay ? 'clear' : 'clear-night' };
  if (code === 2) return { summary: 'Partly cloudy', icon: 'partly' };
  if (code === 3) return { summary: 'Overcast', icon: 'cloudy' };
  if (code === 45 || code === 48) return { summary: 'Foggy', icon: 'fog' };
  if (code >= 51 && code <= 57) return { summary: 'Drizzle', icon: 'drizzle' };
  if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return { summary: 'Rain', icon: 'rain' };
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return { summary: 'Snow', icon: 'snow' };
  if (code >= 95) return { summary: 'Thunderstorms', icon: 'storm' };
  return { summary: 'Mixed conditions', icon: 'cloudy' };
}

export function isWetCode(code: number): boolean {
  return (code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95 || (code >= 71 && code <= 77) || code === 85 || code === 86;
}

export type TempBand = 'freezing' | 'cold' | 'cool' | 'mild' | 'warm' | 'hot';

export interface Climate {
  /** Effective temperature used for clothing (°C), after comfort adjustments. */
  effectiveC: number;
  band: TempBand;
  rainy: boolean;
  windy: boolean;
  /** Ideal warmth (1-5) for the main top, bottom and an outer layer. */
  idealTop: number;
  idealBottom: number;
  idealOuter: number;
  /** Whether an outer layer is needed (true), welcome (null) or unwanted (false). */
  outerwear: boolean | null;
  season: Season;
  /** True when no real weather was available and the climate was inferred from the season. */
  inferred: boolean;
}

export function bandFor(tempC: number): TempBand {
  if (tempC < 0) return 'freezing';
  if (tempC < 8) return 'cold';
  if (tempC < 14) return 'cool';
  if (tempC < 20) return 'mild';
  if (tempC < 26) return 'warm';
  return 'hot';
}

export function seasonFor(date: Date, latitude: number | null = null): Season {
  const month = date.getMonth(); // 0-11
  const northern: Season[] = [
    'winter', 'winter', 'spring', 'spring', 'spring', 'summer',
    'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter',
  ];
  const s = northern[month] ?? 'spring';
  if (latitude !== null && latitude < 0) {
    const flip: Record<Season, Season> = { winter: 'summer', summer: 'winter', spring: 'autumn', autumn: 'spring' };
    return flip[s];
  }
  return s;
}

const SEASON_DEFAULT_TEMP: Record<Season, number> = { winter: 3, spring: 14, summer: 24, autumn: 12 };

export interface ClimateOptions {
  /** -1 runs cold (dress warmer), +1 runs hot (dress lighter). */
  comfort?: -1 | 0 | 1;
  /** -1 = request lighter clothes, +1 = request warmer clothes. */
  warmthAdjust?: -1 | 0 | 1;
  date?: Date;
  latitude?: number | null;
}

/**
 * Derive clothing needs from weather. With no weather, falls back to a typical
 * temperature for the current season so recommendations still work offline.
 */
export function deriveClimate(weather: WeatherContext | null, opts: ClimateOptions = {}): Climate {
  const date = opts.date ?? new Date();
  const season = seasonFor(date, opts.latitude ?? null);
  const inferred = weather === null;
  // Blend feels-like with the day's high so a cold morning doesn't force a parka on a warm afternoon.
  let base = weather ? weather.feelsLikeC * 0.6 + ((weather.highC + weather.lowC) / 2) * 0.4 : SEASON_DEFAULT_TEMP[season];
  // A person who runs cold experiences the day as colder.
  base += (opts.comfort ?? 0) * 3;
  // An explicit "warmer" request means: dress as if it were colder.
  base -= (opts.warmthAdjust ?? 0) * 4;

  const rainy = weather
    ? (weather.precipProbability ?? 0) >= 50 || isWetCode(weather.code)
    : false;
  const windy = weather ? (weather.windKph ?? 0) >= 30 : false;
  const band = bandFor(base);

  const ideals: Record<TempBand, [number, number, number]> = {
    hot: [1, 1, 1],
    warm: [1.5, 2, 1.5],
    mild: [2.2, 2.5, 2],
    cool: [3, 3, 3],
    cold: [3.6, 3.3, 4.2],
    freezing: [4.2, 3.6, 5],
  };
  const [idealTop, idealBottom, idealOuter] = ideals[band];

  let outerwear: boolean | null;
  if (band === 'hot' || band === 'warm') outerwear = rainy && band === 'warm' ? null : false;
  else if (band === 'mild') outerwear = rainy || windy ? true : null;
  else outerwear = true;

  return {
    effectiveC: Math.round(base * 10) / 10,
    band,
    rainy,
    windy,
    idealTop,
    idealBottom,
    idealOuter: rainy && (band === 'mild' || band === 'warm') ? 2 : idealOuter,
    outerwear,
    season,
    inferred,
  };
}

export function cToF(c: number): number {
  return c * (9 / 5) + 32;
}

export function formatTemp(c: number, units: 'C' | 'F'): string {
  const v = units === 'F' ? cToF(c) : c;
  return `${Math.round(v)}°`;
}
